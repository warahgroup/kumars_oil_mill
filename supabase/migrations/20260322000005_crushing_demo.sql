-- Demo crushing samples + clear hook

create or replace function public.clear_user_business_data(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_confirmation is distinct from 'raghul' then
    raise exception 'Confirmation phrase incorrect';
  end if;

  delete from public.sale_items where user_id = v_user;
  delete from public.sales where user_id = v_user;
  delete from public.expenses where user_id = v_user;
  delete from public.bottling_transactions where user_id = v_user;
  delete from public.production_inputs where user_id = v_user;
  delete from public.stock_movements where user_id = v_user;
  delete from public.production_batches where user_id = v_user;
  delete from public.purchase_batches where user_id = v_user;
  delete from public.purchase_transactions where user_id = v_user;
  delete from public.crushing_transactions where user_id = v_user;
  delete from public.financial_transactions where user_id = v_user;
  delete from public.monthly_cost_summaries where user_id = v_user;
  delete from public.price_history where user_id = v_user;
  delete from public.customers where user_id = v_user;
  delete from public.suppliers where user_id = v_user;

  update public.business_settings
  set demo_data_loaded_at = null, demo_data_version = null, updated_at = now()
  where user_id = v_user;
end;
$$;

create or replace function public.load_demo_crushing_samples()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cash uuid;
  v_sesame uuid;
  v_groundnut uuid;
  v_coconut uuid;
  v_kumar uuid;
  v_ravi uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.crushing_transactions where user_id = v_user limit 1) then
    return;
  end if;

  select id into v_cash from public.financial_accounts where user_id = v_user and account_type = 'cash';
  select id into v_sesame from public.raw_materials where user_id = v_user and code = 'SES-SEED';
  select id into v_groundnut from public.raw_materials where user_id = v_user and code = 'GND-NUT';
  select id into v_coconut from public.raw_materials where user_id = v_user and code = 'COC-NUT';

  insert into public.customers (user_id, name, phone, address, customer_type)
  values (v_user, 'Kumar', '9840033333', 'Shop: Kumar' || E'\n' || 'Town', 'retail')
  returning id into v_kumar;
  insert into public.customers (user_id, name, phone, address, customer_type)
  values (v_user, 'Ravi', '9840044444', 'Shop: Ravi Oil' || E'\n' || 'Peelamedu', 'retail')
  returning id into v_ravi;

  perform public.record_crushing(jsonb_build_object(
    'customer_id', v_kumar, 'raw_material_id', v_sesame, 'crushing_date', '2026-09-14',
    'input_quantity', 50, 'oil_output_quantity', 20, 'cake_output_quantity', 27,
    'cake_handling', 'customer_takes', 'crushing_rate_per_kg', 15,
    'financial_account_id', v_cash, 'idempotency_key', 'demo-crush-1'
  ));

  perform public.record_crushing(jsonb_build_object(
    'customer_id', v_kumar, 'raw_material_id', v_sesame, 'crushing_date', '2026-09-15',
    'input_quantity', 50, 'oil_output_quantity', 19.5, 'cake_output_quantity', 27,
    'cake_handling', 'sell_to_mill', 'crushing_rate_per_kg', 15, 'cake_purchase_rate_per_kg', 25,
    'financial_account_id', v_cash, 'idempotency_key', 'demo-crush-2'
  ));

  perform public.record_crushing(jsonb_build_object(
    'customer_id', v_ravi, 'raw_material_id', v_groundnut, 'crushing_date', '2026-09-16',
    'input_quantity', 40, 'oil_output_quantity', 15, 'cake_output_quantity', 20,
    'cake_handling', 'sell_to_mill', 'crushing_rate_per_kg', 15, 'cake_purchase_rate_per_kg', 20,
    'financial_account_id', v_cash, 'idempotency_key', 'demo-crush-3'
  ));

  perform public.record_crushing(jsonb_build_object(
    'customer_id', v_ravi, 'raw_material_id', v_coconut, 'crushing_date', '2026-09-17',
    'input_quantity', 40, 'oil_output_quantity', 22, 'cake_output_quantity', 12,
    'cake_handling', 'sell_to_mill', 'crushing_rate_per_kg', 12, 'cake_purchase_rate_per_kg', 60,
    'financial_account_id', v_cash, 'idempotency_key', 'demo-crush-4'
  ));
end;
$$;

grant execute on function public.load_demo_crushing_samples() to authenticated;
