-- Secure RPC functions (atomic business operations)

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger business_settings_updated before update on public.business_settings
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Monthly weighted average helper
-- ---------------------------------------------------------------------------
create or replace function public.upsert_monthly_cost_summary(
  p_user_id uuid,
  p_raw_material_id uuid,
  p_year int,
  p_month int,
  p_quantity numeric,
  p_line_cost numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_qty numeric;
  v_total_cost numeric;
  v_avg numeric;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;

  insert into public.monthly_cost_summaries (user_id, raw_material_id, year, month, total_quantity, total_cost, weighted_avg_cost)
  values (p_user_id, p_raw_material_id, p_year, p_month, p_quantity, p_line_cost, case when p_quantity > 0 then p_line_cost / p_quantity else 0 end)
  on conflict (user_id, raw_material_id, year, month)
  do update set
    total_quantity = monthly_cost_summaries.total_quantity + excluded.total_quantity,
    total_cost = monthly_cost_summaries.total_cost + excluded.total_cost,
    weighted_avg_cost = case
      when monthly_cost_summaries.total_quantity + excluded.total_quantity > 0
      then (monthly_cost_summaries.total_cost + excluded.total_cost)
           / (monthly_cost_summaries.total_quantity + excluded.total_quantity)
      else 0
    end,
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Default business seed (onboarding)
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_business_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sesame_oil uuid;
  v_coconut_oil uuid;
  v_groundnut_oil uuid;
  v_sesame_cake uuid;
  v_coconut_cake uuid;
  v_groundnut_cake uuid;
  v_coffee uuid;
  v_jaggery_powder uuid;
  v_sesame_seed uuid;
  v_coconut uuid;
  v_groundnut uuid;
  v_jaggery_rm uuid;
  v_recipe_sesame uuid;
  v_recipe_coconut uuid;
  v_recipe_groundnut uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.products where user_id = v_user limit 1) then
    return;
  end if;

  insert into public.business_settings (user_id, business_name, onboarding_completed)
  values (v_user, 'My Oil Mill', false)
  on conflict (user_id) do nothing;

  insert into public.financial_accounts (user_id, name, account_type, opening_balance)
  values
    (v_user, 'Cash', 'cash', 0),
    (v_user, 'UPI', 'upi', 0),
    (v_user, 'Bank', 'bank', 0)
  on conflict (user_id, account_type) do nothing;

  insert into public.expense_categories (user_id, name)
  values
    (v_user, 'Labour'),
    (v_user, 'Electricity'),
    (v_user, 'Transport'),
    (v_user, 'Maintenance'),
    (v_user, 'Miscellaneous')
  on conflict (user_id, name) do nothing;

  -- Products
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Sesame Oil', 'SES-OIL', 'L', true, false, 0) returning id into v_sesame_oil;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Coconut Oil', 'COC-OIL', 'L', true, false, 0) returning id into v_coconut_oil;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Groundnut Oil', 'GND-OIL', 'L', true, false, 0) returning id into v_groundnut_oil;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Coffee Powder', 'COF-PWD', 'kg', false, false, 0) returning id into v_coffee;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Jaggery Powder', 'JAG-PWD', 'kg', false, false, 0) returning id into v_jaggery_powder;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Sesame Cake', 'SES-CAKE', 'kg', false, true, 0) returning id into v_sesame_cake;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Coconut Cake', 'COC-CAKE', 'kg', false, true, 0) returning id into v_coconut_cake;
  insert into public.products (user_id, name, code, unit, is_oil, is_waste, retail_price)
  values (v_user, 'Groundnut Cake', 'GND-CAKE', 'kg', false, true, 0) returning id into v_groundnut_cake;

  -- Raw materials
  insert into public.raw_materials (user_id, name, code, unit, shelf_life_days)
  values (v_user, 'Sesame Seed', 'SES-SEED', 'kg', 180) returning id into v_sesame_seed;
  insert into public.raw_materials (user_id, name, code, unit, shelf_life_days)
  values (v_user, 'Coconut', 'COC-NUT', 'kg', 30) returning id into v_coconut;
  insert into public.raw_materials (user_id, name, code, unit, shelf_life_days)
  values (v_user, 'Groundnut', 'GND-NUT', 'kg', 120) returning id into v_groundnut;
  insert into public.raw_materials (user_id, name, code, unit, shelf_life_days)
  values (v_user, 'Coffee Powder', 'COF-RM', 'kg', 365) returning id into v_coffee;
  insert into public.raw_materials (user_id, name, code, unit, shelf_life_days)
  values (v_user, 'Jaggery Powder', 'JAG-RM', 'kg', 180) returning id into v_jaggery_rm;

  -- Packages (per oil product)
  insert into public.product_packages (user_id, product_id, label, size_ml, packaging_cost)
  select v_user, p.id, pkg.label, pkg.size_ml, pkg.cost
  from public.products p
  cross join (values ('500 ml', 500, 8::numeric), ('1 L', 1000, 12::numeric), ('5 L', 5000, 35::numeric)) as pkg(label, size_ml, cost)
  where p.user_id = v_user and p.is_oil = true;

  -- Recipes (defaults — editable later)
  insert into public.recipes (user_id, name, output_product_id, base_raw_material_id, base_raw_qty, expected_oil_litres, expected_waste_kg)
  values (v_user, 'Sesame Oil Recipe', v_sesame_oil, v_sesame_seed, 10, 4, 5.5) returning id into v_recipe_sesame;
  insert into public.recipe_ingredients (user_id, recipe_id, raw_material_id, quantity, unit)
  values (v_user, v_recipe_sesame, v_sesame_seed, 10, 'kg'), (v_user, v_recipe_sesame, v_jaggery_rm, 0.2, 'kg');

  insert into public.recipes (user_id, name, output_product_id, base_raw_material_id, base_raw_qty, expected_oil_litres, expected_waste_kg)
  values (v_user, 'Coconut Oil Recipe', v_coconut_oil, v_coconut, 10, 6, 3) returning id into v_recipe_coconut;
  insert into public.recipe_ingredients (user_id, recipe_id, raw_material_id, quantity, unit)
  values (v_user, v_recipe_coconut, v_coconut, 10, 'kg');

  insert into public.recipes (user_id, name, output_product_id, base_raw_material_id, base_raw_qty, expected_oil_litres, expected_waste_kg)
  values (v_user, 'Groundnut Oil Recipe', v_groundnut_oil, v_groundnut, 10, 4, 5) returning id into v_recipe_groundnut;
  insert into public.recipe_ingredients (user_id, recipe_id, raw_material_id, quantity, unit)
  values (v_user, v_recipe_groundnut, v_groundnut, 10, 'kg');

  update public.business_settings set onboarding_completed = true, updated_at = now() where user_id = v_user;
end;
$$;

grant execute on function public.seed_default_business_data() to authenticated;

-- ---------------------------------------------------------------------------
-- record_purchase
-- payload: { supplier_id?, transaction_date, reference_no?, idempotency_key?, notes?,
--   financial_account_id, lines: [{ raw_material_id, quantity, unit_cost, purchase_date, expiry_date?, batch_code? }] }
-- ---------------------------------------------------------------------------
create or replace function public.record_purchase(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_purchase_id uuid;
  v_account_id uuid;
  v_total numeric := 0;
  v_line jsonb;
  v_qty numeric;
  v_cost numeric;
  v_expiry date;
  v_shelf int;
  v_batch_id uuid;
  v_purchase_date date;
  v_idem text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_idem := p_payload->>'idempotency_key';
  if v_idem is not null and exists (
    select 1 from public.purchase_transactions where user_id = v_user and idempotency_key = v_idem
  ) then
    return (select id from public.purchase_transactions where user_id = v_user and idempotency_key = v_idem limit 1);
  end if;

  v_account_id := (p_payload->>'financial_account_id')::uuid;
  if not exists (select 1 from public.financial_accounts where id = v_account_id and user_id = v_user) then
    raise exception 'Invalid financial account';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_payload->'lines', '[]'::jsonb))
  loop
    v_qty := (v_line->>'quantity')::numeric;
    v_cost := (v_line->>'unit_cost')::numeric;
    if v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    v_total := v_total + (v_qty * v_cost);
  end loop;

  if v_total <= 0 then raise exception 'Purchase total must be positive'; end if;

  insert into public.purchase_transactions (
    user_id, supplier_id, transaction_date, reference_no, idempotency_key, total_amount, notes, financial_account_id
  ) values (
    v_user,
    (p_payload->>'supplier_id')::uuid,
    coalesce((p_payload->>'transaction_date')::date, current_date),
    p_payload->>'reference_no',
    v_idem,
    v_total,
    p_payload->>'notes',
    v_account_id
  ) returning id into v_purchase_id;

  for v_line in select * from jsonb_array_elements(p_payload->'lines')
  loop
    v_qty := (v_line->>'quantity')::numeric;
    v_cost := (v_line->>'unit_cost')::numeric;
    v_purchase_date := coalesce((v_line->>'purchase_date')::date, (p_payload->>'transaction_date')::date, current_date);

    select shelf_life_days into v_shelf from public.raw_materials
    where id = (v_line->>'raw_material_id')::uuid and user_id = v_user;

    v_expiry := coalesce(
      (v_line->>'expiry_date')::date,
      v_purchase_date + make_interval(days => coalesce(v_shelf, 180))
    );

    insert into public.purchase_batches (
      user_id, purchase_transaction_id, raw_material_id, batch_code,
      original_quantity, remaining_quantity, purchase_date, expiry_date, unit_cost
    ) values (
      v_user, v_purchase_id, (v_line->>'raw_material_id')::uuid,
      coalesce(v_line->>'batch_code', 'PB-' || left(gen_random_uuid()::text, 8)),
      v_qty, v_qty, v_purchase_date, v_expiry, v_cost
    ) returning id into v_batch_id;

    insert into public.stock_movements (
      user_id, movement_date, direction, item_type, raw_material_id, purchase_batch_id,
      quantity, unit_cost, reference_kind, reference_id
    ) values (
      v_user, v_purchase_date, 'in', 'raw_material', (v_line->>'raw_material_id')::uuid, v_batch_id,
      v_qty, v_cost, 'purchase', v_purchase_id
    );

    perform public.upsert_monthly_cost_summary(
      v_user,
      (v_line->>'raw_material_id')::uuid,
      extract(year from v_purchase_date)::int,
      extract(month from v_purchase_date)::int,
      v_qty,
      v_qty * v_cost
    );
  end loop;

  insert into public.financial_transactions (
    user_id, financial_account_id, transaction_date, direction, amount, reference_kind, reference_id, description
  ) values (
    v_user, v_account_id, coalesce((p_payload->>'transaction_date')::date, current_date),
    'out', v_total, 'purchase', v_purchase_id, 'Purchase'
  );

  return v_purchase_id;
end;
$$;

grant execute on function public.record_purchase(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- record_production (simplified FEFO consumption from purchase batches)
-- ---------------------------------------------------------------------------
create or replace function public.record_production(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_batch_id uuid;
  v_recipe record;
  v_idem text;
  v_raw_cost numeric := 0;
  v_ingredient_cost numeric := 0;
  v_labour numeric;
  v_electricity numeric;
  v_overhead numeric;
  v_waste_value numeric;
  v_effective numeric;
  v_oil_out numeric;
  v_waste_out numeric;
  v_cost_per_litre numeric;
  v_expiry date;
  v_consume jsonb;
  v_rm_id uuid;
  v_need numeric;
  v_pb record;
  v_take numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_idem := p_payload->>'idempotency_key';
  if v_idem is not null and exists (select 1 from public.production_batches where user_id = v_user and idempotency_key = v_idem) then
    return (select id from public.production_batches where user_id = v_user and idempotency_key = v_idem limit 1);
  end if;

  select * into v_recipe from public.recipes
  where id = (p_payload->>'recipe_id')::uuid and user_id = v_user and active = true;
  if not found then raise exception 'Recipe not found'; end if;

  v_oil_out := coalesce((p_payload->>'oil_output_litres')::numeric, v_recipe.expected_oil_litres);
  v_waste_out := coalesce((p_payload->>'waste_output_kg')::numeric, v_recipe.expected_waste_kg);
  if v_oil_out <= 0 then raise exception 'Oil output required'; end if;

  v_labour := coalesce((p_payload->>'labour_cost')::numeric, 0);
  v_electricity := coalesce((p_payload->>'electricity_cost')::numeric, 0);
  v_overhead := coalesce((p_payload->>'overhead_cost')::numeric, 0);
  v_waste_value := coalesce((p_payload->>'waste_value')::numeric, 0);

  insert into public.production_batches (
    user_id, recipe_id, output_product_id, production_date, expiry_date,
    oil_output_litres, waste_output_kg, remaining_bulk_litres,
    labour_cost, electricity_cost, overhead_cost, waste_value,
    effective_production_cost, cost_per_litre, idempotency_key, notes
  ) values (
    v_user, v_recipe.id, v_recipe.output_product_id,
    coalesce((p_payload->>'production_date')::date, current_date),
    coalesce((p_payload->>'expiry_date')::date, current_date + interval '180 days'),
    v_oil_out, v_waste_out, v_oil_out,
    v_labour, v_electricity, v_overhead, v_waste_value,
    0, 0, v_idem, p_payload->>'notes'
  ) returning id, expiry_date into v_batch_id, v_expiry;

  for v_consume in
    select jsonb_build_object(
      'raw_material_id', ri.raw_material_id,
      'quantity', ri.quantity * (v_oil_out / v_recipe.expected_oil_litres)
    ) as row
    from public.recipe_ingredients ri
    where ri.recipe_id = v_recipe.id and ri.user_id = v_user and ri.raw_material_id is not null
  loop
    v_rm_id := (v_consume->>'raw_material_id')::uuid;
    v_need := (v_consume->>'quantity')::numeric;

    for v_pb in
      select * from public.purchase_batches
      where user_id = v_user and raw_material_id = v_rm_id and remaining_quantity > 0 and expiry_date >= current_date
      order by expiry_date asc, purchase_date asc
    loop
      if v_need <= 0 then exit; end if;
      v_take := least(v_need, v_pb.remaining_quantity);

      update public.purchase_batches set remaining_quantity = remaining_quantity - v_take where id = v_pb.id;

      insert into public.production_inputs (
        user_id, production_batch_id, purchase_batch_id, raw_material_id, quantity, unit_cost, total_cost
      ) values (v_user, v_batch_id, v_pb.id, v_rm_id, v_take, v_pb.unit_cost, v_take * v_pb.unit_cost);

      insert into public.stock_movements (
        user_id, movement_date, direction, item_type, raw_material_id, purchase_batch_id, production_batch_id,
        quantity, unit_cost, reference_kind, reference_id
      ) values (
        v_user, coalesce((p_payload->>'production_date')::date, current_date), 'out', 'raw_material',
        v_rm_id, v_pb.id, v_batch_id, v_take, v_pb.unit_cost, 'production', v_batch_id
      );

      v_raw_cost := v_raw_cost + (v_take * v_pb.unit_cost);
      v_need := v_need - v_take;
    end loop;

    if v_need > 0.001 then
      raise exception 'Insufficient non-expired raw material stock';
    end if;
  end loop;

  v_effective := v_raw_cost + v_ingredient_cost + v_labour + v_electricity + v_overhead - v_waste_value;
  v_cost_per_litre := case when v_oil_out > 0 then v_effective / v_oil_out else 0 end;

  update public.production_batches set
    raw_material_cost = v_raw_cost,
    ingredient_cost = v_ingredient_cost,
    effective_production_cost = v_effective,
    cost_per_litre = v_cost_per_litre
  where id = v_batch_id;

  insert into public.stock_movements (
    user_id, movement_date, direction, item_type, product_id, production_batch_id,
    quantity, unit_cost, reference_kind, reference_id
  ) values (
    v_user, coalesce((p_payload->>'production_date')::date, current_date), 'in', 'bulk_oil',
    v_recipe.output_product_id, v_batch_id, v_oil_out, v_cost_per_litre, 'production', v_batch_id
  );

  if v_waste_out > 0 then
    insert into public.stock_movements (
      user_id, movement_date, direction, item_type, product_id, production_batch_id,
      quantity, unit_cost, reference_kind, reference_id
    )
    select v_user, coalesce((p_payload->>'production_date')::date, current_date), 'in', 'waste',
      wp.id, v_batch_id, v_waste_out, 0, 'production', v_batch_id
    from public.products wp
    where wp.user_id = v_user and wp.is_waste = true and wp.code like left((select code from public.products where id = v_recipe.output_product_id), 3) || '%'
    limit 1;
  end if;

  return v_batch_id;
end;
$$;

grant execute on function public.record_production(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- record_bottling
-- ---------------------------------------------------------------------------
create or replace function public.record_bottling(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_idem text;
  v_pkg record;
  v_prod record;
  v_litres_per_pkg numeric;
  v_bulk_needed numeric;
  v_count int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_idem := p_payload->>'idempotency_key';
  if v_idem is not null and exists (select 1 from public.bottling_transactions where user_id = v_user and idempotency_key = v_idem) then
    return (select id from public.bottling_transactions where user_id = v_user and idempotency_key = v_idem limit 1);
  end if;

  v_count := (p_payload->>'package_count')::int;
  if v_count is null or v_count <= 0 then raise exception 'Invalid package count'; end if;

  select pp.*, p.id as oil_product_id into v_pkg
  from public.product_packages pp
  join public.products p on p.id = pp.product_id
  where pp.id = (p_payload->>'product_package_id')::uuid and pp.user_id = v_user;

  if not found then raise exception 'Package not found'; end if;

  select * into v_prod from public.production_batches
  where id = (p_payload->>'production_batch_id')::uuid and user_id = v_user;
  if not found then raise exception 'Production batch not found'; end if;
  if v_prod.expiry_date < current_date then raise exception 'Production batch expired'; end if;

  v_litres_per_pkg := coalesce(v_pkg.size_ml, 0) / 1000.0;
  v_bulk_needed := v_litres_per_pkg * v_count;

  if v_prod.remaining_bulk_litres < v_bulk_needed then
    raise exception 'Insufficient bulk oil in production batch';
  end if;

  update public.production_batches
  set remaining_bulk_litres = remaining_bulk_litres - v_bulk_needed
  where id = v_prod.id;

  insert into public.bottling_transactions (
    user_id, production_batch_id, product_package_id, transaction_date,
    package_count, bulk_litres_used, packaging_cost_total, idempotency_key, notes
  ) values (
    v_user, v_prod.id, v_pkg.id,
    coalesce((p_payload->>'transaction_date')::date, current_date),
    v_count, v_bulk_needed, v_count * v_pkg.packaging_cost, v_idem, p_payload->>'notes'
  ) returning id into v_id;

  insert into public.stock_movements (
    user_id, movement_date, direction, item_type, product_id, production_batch_id,
    quantity, unit_cost, reference_kind, reference_id, notes
  ) values (
    v_user, coalesce((p_payload->>'transaction_date')::date, current_date), 'out', 'bulk_oil',
    v_prod.output_product_id, v_prod.id, v_bulk_needed, v_prod.cost_per_litre, 'bottling', v_id, 'Bulk to packaging'
  );

  insert into public.stock_movements (
    user_id, movement_date, direction, item_type, product_id, product_package_id, production_batch_id,
    quantity, unit_cost, reference_kind, reference_id
  ) values (
    v_user, coalesce((p_payload->>'transaction_date')::date, current_date), 'in', 'packaged',
    v_pkg.product_id, v_pkg.id, v_prod.id, v_count, v_prod.cost_per_litre + v_pkg.packaging_cost, 'bottling', v_id
  );

  return v_id;
end;
$$;

grant execute on function public.record_bottling(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- record_sale
-- ---------------------------------------------------------------------------
create or replace function public.record_sale(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid;
  v_idem text;
  v_account_id uuid;
  v_line jsonb;
  v_subtotal numeric := 0;
  v_cogs numeric := 0;
  v_total numeric;
  v_discount numeric;
  v_qty numeric;
  v_price numeric;
  v_line_total numeric;
  v_unit_cost numeric;
  v_line_cogs numeric;
  v_is_bulk boolean;
  v_prod_batch record;
  v_pkg record;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_idem := p_payload->>'idempotency_key';
  if v_idem is not null and exists (select 1 from public.sales where user_id = v_user and idempotency_key = v_idem) then
    return (select id from public.sales where user_id = v_user and idempotency_key = v_idem limit 1);
  end if;

  v_account_id := (p_payload->>'financial_account_id')::uuid;
  v_discount := coalesce((p_payload->>'discount')::numeric, 0);

  insert into public.sales (
    user_id, customer_id, sale_date, reference_no, idempotency_key,
    subtotal, discount, total_amount, total_cogs, financial_account_id, notes
  ) values (
    v_user, (p_payload->>'customer_id')::uuid,
    coalesce((p_payload->>'sale_date')::date, current_date),
    p_payload->>'reference_no', v_idem, 0, v_discount, 0, 0, v_account_id, p_payload->>'notes'
  ) returning id into v_sale_id;

  for v_line in select * from jsonb_array_elements(p_payload->'lines')
  loop
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    v_is_bulk := coalesce((v_line->>'is_bulk_sale')::boolean, false);
    v_line_total := v_qty * v_price;
    v_subtotal := v_subtotal + v_line_total;

    if v_is_bulk then
      select * into v_prod_batch from public.production_batches
      where id = (v_line->>'production_batch_id')::uuid and user_id = v_user;
      if not found then raise exception 'Production batch not found'; end if;
      if v_prod_batch.expiry_date < current_date then raise exception 'Cannot sell expired bulk oil'; end if;
      if v_prod_batch.remaining_bulk_litres < v_qty then raise exception 'Insufficient bulk stock'; end if;

      v_unit_cost := v_prod_batch.cost_per_litre;
      v_line_cogs := v_qty * v_unit_cost;

      update public.production_batches set remaining_bulk_litres = remaining_bulk_litres - v_qty where id = v_prod_batch.id;

      insert into public.stock_movements (
        user_id, movement_date, direction, item_type, product_id, production_batch_id,
        quantity, unit_cost, reference_kind, reference_id
      ) values (
        v_user, coalesce((p_payload->>'sale_date')::date, current_date), 'out', 'bulk_oil',
        (v_line->>'product_id')::uuid, v_prod_batch.id, v_qty, v_unit_cost, 'sale', v_sale_id
      );
    else
      select pp.*, pb.cost_per_litre, pb.expiry_date as batch_expiry, pb.id as batch_id into v_pkg
      from public.product_packages pp
      join public.production_batches pb on pb.id = (v_line->>'production_batch_id')::uuid and pb.user_id = v_user
      where pp.id = (v_line->>'product_package_id')::uuid and pp.user_id = v_user;

      if not found then raise exception 'Packaged item batch not found'; end if;
      if v_pkg.batch_expiry < current_date then raise exception 'Cannot sell expired packaged stock'; end if;

      v_unit_cost := v_pkg.cost_per_litre + v_pkg.packaging_cost;
      v_line_cogs := v_qty * v_unit_cost;

      insert into public.stock_movements (
        user_id, movement_date, direction, item_type, product_id, product_package_id, production_batch_id,
        quantity, unit_cost, reference_kind, reference_id
      ) values (
        v_user, coalesce((p_payload->>'sale_date')::date, current_date), 'out', 'packaged',
        (v_line->>'product_id')::uuid, v_pkg.id, v_pkg.batch_id, v_qty, v_unit_cost, 'sale', v_sale_id
      );
    end if;

    v_cogs := v_cogs + v_line_cogs;

    insert into public.sale_items (
      user_id, sale_id, product_id, product_package_id, production_batch_id, is_bulk_sale,
      quantity, unit_price, line_total, unit_cost, line_cogs
    ) values (
      v_user, v_sale_id, (v_line->>'product_id')::uuid,
      (v_line->>'product_package_id')::uuid, (v_line->>'production_batch_id')::uuid, v_is_bulk,
      v_qty, v_price, v_line_total, v_unit_cost, v_line_cogs
    );
  end loop;

  v_total := v_subtotal - v_discount;

  update public.sales set subtotal = v_subtotal, total_amount = v_total, total_cogs = v_cogs where id = v_sale_id;

  insert into public.financial_transactions (
    user_id, financial_account_id, transaction_date, direction, amount, reference_kind, reference_id, description
  ) values (
    v_user, v_account_id, coalesce((p_payload->>'sale_date')::date, current_date),
    'in', v_total, 'sale', v_sale_id, 'Sale'
  );

  return v_sale_id;
end;
$$;

grant execute on function public.record_sale(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- record_expense
-- ---------------------------------------------------------------------------
create or replace function public.record_expense(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_idem text;
  v_amount numeric;
  v_account_id uuid;
  v_category_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  v_idem := p_payload->>'idempotency_key';
  if v_idem is not null and exists (select 1 from public.expenses where user_id = v_user and idempotency_key = v_idem) then
    return (select id from public.expenses where user_id = v_user and idempotency_key = v_idem limit 1);
  end if;

  v_amount := (p_payload->>'amount')::numeric;
  if v_amount is null or v_amount <= 0 then raise exception 'Invalid amount'; end if;

  v_account_id := (p_payload->>'financial_account_id')::uuid;
  v_category_id := (p_payload->>'expense_category_id')::uuid;

  insert into public.expenses (
    user_id, expense_category_id, expense_date, amount, description, financial_account_id, idempotency_key
  ) values (
    v_user, v_category_id,
    coalesce((p_payload->>'expense_date')::date, current_date),
    v_amount, p_payload->>'description', v_account_id, v_idem
  ) returning id into v_id;

  insert into public.financial_transactions (
    user_id, financial_account_id, transaction_date, direction, amount, reference_kind, reference_id, description
  ) values (
    v_user, v_account_id, coalesce((p_payload->>'expense_date')::date, current_date),
    'out', v_amount, 'expense', v_id, coalesce(p_payload->>'description', 'Expense')
  );

  return v_id;
end;
$$;

grant execute on function public.record_expense(jsonb) to authenticated;

-- Account balance view helper
create or replace function public.get_account_balance(p_account_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select fa.opening_balance
    + coalesce(sum(case when ft.direction = 'in' then ft.amount else -ft.amount end), 0)
  from public.financial_accounts fa
  left join public.financial_transactions ft on ft.financial_account_id = fa.id and ft.user_id = fa.user_id
  where fa.id = p_account_id and fa.user_id = auth.uid()
  group by fa.opening_balance;
$$;

grant execute on function public.get_account_balance(uuid) to authenticated;
