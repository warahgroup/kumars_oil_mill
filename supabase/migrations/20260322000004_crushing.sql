-- Crushing service (customer-owned material — separate from mill production)

alter type public.reference_kind add value if not exists 'crushing';

create type public.crushing_cake_handling as enum ('customer_takes', 'sell_to_mill');
create type public.crushing_settlement_direction as enum (
  'customer_pays_mill',
  'mill_pays_customer',
  'settled'
);
create type public.crushing_status as enum ('received', 'crushing', 'completed', 'cancelled');

alter table public.business_settings
  add column if not exists crushing_settings jsonb not null default '{
    "charge_per_kg_by_raw_code": {"SES-SEED": 15, "GND-NUT": 15, "COC-NUT": 12},
    "cake_rate_by_product_code": {"SES-CAKE": 25, "GND-CAKE": 20, "COC-CAKE": 15}
  }'::jsonb;

create table public.crushing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_code text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  raw_material_id uuid not null references public.raw_materials (id) on delete restrict,
  cake_product_id uuid references public.products (id) on delete restrict,
  crushing_date date not null default current_date,
  input_quantity numeric(14, 3) not null check (input_quantity > 0),
  input_unit text not null default 'kg',
  oil_output_quantity numeric(14, 3) not null default 0 check (oil_output_quantity >= 0),
  oil_output_unit text not null default 'L',
  cake_output_quantity numeric(14, 3) not null default 0 check (cake_output_quantity >= 0),
  cake_output_unit text not null default 'kg',
  cake_handling public.crushing_cake_handling not null,
  crushing_rate_per_kg numeric(12, 2) not null,
  crushing_charge numeric(14, 2) not null,
  cake_purchase_rate_per_kg numeric(12, 2),
  cake_purchase_value numeric(14, 2) not null default 0,
  net_settlement_amount numeric(14, 2) not null default 0,
  settlement_direction public.crushing_settlement_direction not null,
  financial_account_id uuid references public.financial_accounts (id) on delete restrict,
  status public.crushing_status not null default 'completed',
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, transaction_code),
  unique (user_id, idempotency_key)
);

create index idx_crushing_user_date on public.crushing_transactions (user_id, crushing_date desc);

alter table public.crushing_transactions enable row level security;

create policy "crushing_transactions_select" on public.crushing_transactions
  for select using (auth.uid() = user_id);
create policy "crushing_transactions_insert" on public.crushing_transactions
  for insert with check (auth.uid() = user_id);
create policy "crushing_transactions_update" on public.crushing_transactions
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- record_crushing — atomic: crushing row + cake stock IN + financial IN/OUT
-- payload: {
--   customer_id, raw_material_id, crushing_date?, input_quantity,
--   oil_output_quantity, cake_output_quantity,
--   cake_handling: 'customer_takes' | 'sell_to_mill',
--   crushing_rate_per_kg?, cake_purchase_rate_per_kg?,
--   financial_account_id, idempotency_key?, notes?
-- }
-- ---------------------------------------------------------------------------
create or replace function public.record_crushing(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_idem text;
  v_customer_id uuid;
  v_rm_id uuid;
  v_rm_code text;
  v_cake_product_id uuid;
  v_date date;
  v_input numeric;
  v_oil numeric;
  v_cake numeric;
  v_handling public.crushing_cake_handling;
  v_rate numeric;
  v_cake_rate numeric;
  v_charge numeric;
  v_cake_value numeric;
  v_net numeric;
  v_dir public.crushing_settlement_direction;
  v_account_id uuid;
  v_code text;
  v_seq int;
  v_settings jsonb;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_idem := p_payload->>'idempotency_key';
  if v_idem is not null and exists (
    select 1 from public.crushing_transactions where user_id = v_user and idempotency_key = v_idem
  ) then
    return (select id from public.crushing_transactions where user_id = v_user and idempotency_key = v_idem limit 1);
  end if;

  v_customer_id := (p_payload->>'customer_id')::uuid;
  v_rm_id := (p_payload->>'raw_material_id')::uuid;
  v_input := (p_payload->>'input_quantity')::numeric;
  v_oil := coalesce((p_payload->>'oil_output_quantity')::numeric, 0);
  v_cake := coalesce((p_payload->>'cake_output_quantity')::numeric, 0);
  if v_customer_id is null or v_rm_id is null then raise exception 'Customer and raw material required'; end if;
  if v_input is null or v_input <= 0 then raise exception 'Input weight must be positive'; end if;

  v_handling := (p_payload->>'cake_handling')::public.crushing_cake_handling;
  if v_handling is null then raise exception 'Cake handling required'; end if;

  select code into v_rm_code from public.raw_materials where id = v_rm_id and user_id = v_user;
  if v_rm_code is null then raise exception 'Invalid raw material'; end if;

  select crushing_settings into v_settings from public.business_settings where user_id = v_user;

  v_rate := coalesce(
    (p_payload->>'crushing_rate_per_kg')::numeric,
    (v_settings->'charge_per_kg_by_raw_code'->>v_rm_code)::numeric,
    0
  );
  if v_rate <= 0 then raise exception 'Crushing rate not configured'; end if;

  v_cake_product_id := case v_rm_code
    when 'SES-SEED' then (select id from public.products where user_id = v_user and code = 'SES-CAKE' limit 1)
    when 'GND-NUT' then (select id from public.products where user_id = v_user and code = 'GND-CAKE' limit 1)
    when 'COC-NUT' then (select id from public.products where user_id = v_user and code = 'COC-CAKE' limit 1)
    else null
  end;

  if v_handling = 'sell_to_mill' then
    if v_cake_product_id is null then raise exception 'No cake product mapped for this material'; end if;
    v_cake_rate := coalesce(
      (p_payload->>'cake_purchase_rate_per_kg')::numeric,
      (v_settings->'cake_rate_by_product_code'->>(
        select code from public.products where id = v_cake_product_id
      ))::numeric,
      0
    );
    if v_cake_rate <= 0 then raise exception 'Cake purchase rate required'; end if;
    v_cake_value := v_cake * v_cake_rate;
  else
    v_cake_rate := null;
    v_cake_value := 0;
  end if;

  v_charge := round(v_input * v_rate, 2);
  v_net := v_charge - v_cake_value;
  if v_net > 0 then
    v_dir := 'customer_pays_mill';
  elsif v_net < 0 then
    v_dir := 'mill_pays_customer';
  else
    v_dir := 'settled';
  end if;

  v_account_id := (p_payload->>'financial_account_id')::uuid;
  if v_dir <> 'settled' and v_account_id is null then
    raise exception 'Payment account required for settlement';
  end if;
  if v_account_id is not null and not exists (
    select 1 from public.financial_accounts where id = v_account_id and user_id = v_user
  ) then
    raise exception 'Invalid financial account';
  end if;

  v_date := coalesce((p_payload->>'crushing_date')::date, current_date);

  select count(*) + 1 into v_seq
  from public.crushing_transactions
  where user_id = v_user and crushing_date = v_date;

  v_code := 'CR-' || to_char(v_date, 'YYYYMMDD') || '-' ||
    replace(upper(v_rm_code), '-', '') || '-' ||
    replace(trim(to_char(v_input, 'FM9999990.###')), '.', '') || 'KG-' ||
    lpad(v_seq::text, 3, '0');

  insert into public.crushing_transactions (
    user_id, transaction_code, customer_id, raw_material_id, cake_product_id,
    crushing_date, input_quantity, oil_output_quantity, cake_output_quantity,
    cake_handling, crushing_rate_per_kg, crushing_charge,
    cake_purchase_rate_per_kg, cake_purchase_value,
    net_settlement_amount, settlement_direction, financial_account_id,
    status, notes, idempotency_key
  ) values (
    v_user, v_code, v_customer_id, v_rm_id, v_cake_product_id,
    v_date, v_input, v_oil, v_cake,
    v_handling, v_rate, v_charge,
    v_cake_rate, v_cake_value,
    abs(v_net), v_dir, v_account_id,
    'completed', p_payload->>'notes', v_idem
  ) returning id into v_id;

  -- Crushing service income (full charge, not net only)
  if v_charge > 0 then
    insert into public.financial_transactions (
      user_id, financial_account_id, transaction_date, direction, amount,
      reference_kind, reference_id, description
    ) values (
      v_user, coalesce(v_account_id, (
        select id from public.financial_accounts where user_id = v_user and account_type = 'cash' limit 1
      )),
      v_date, 'in', v_charge, 'crushing', v_id,
      'Crushing service charge'
    );
  end if;

  if v_cake_value > 0 and v_account_id is not null then
    insert into public.financial_transactions (
      user_id, financial_account_id, transaction_date, direction, amount,
      reference_kind, reference_id, description
    ) values (
      v_user, v_account_id, v_date, 'out', v_cake_value, 'crushing', v_id,
      'Cake bought from customer (crushing)'
    );
  end if;

  if v_handling = 'sell_to_mill' and v_cake > 0 and v_cake_product_id is not null then
    insert into public.stock_movements (
      user_id, movement_date, direction, item_type, product_id,
      quantity, unit_cost, reference_kind, reference_id, notes
    ) values (
      v_user, v_date, 'in', 'waste', v_cake_product_id,
      v_cake, coalesce(v_cake_rate, 0), 'crushing', v_id,
      'Cake from crushing settlement'
    );
  end if;

  return v_id;
end;
$$;

grant execute on function public.record_crushing(jsonb) to authenticated;
