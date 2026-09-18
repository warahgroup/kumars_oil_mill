-- Demo data flags + clear + 7-day load + validation

alter table public.business_settings
  add column if not exists demo_data_loaded_at timestamptz,
  add column if not exists demo_data_version text;

-- ---------------------------------------------------------------------------
-- Clear all business data for current user (master data kept)
-- ---------------------------------------------------------------------------
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

grant execute on function public.clear_user_business_data(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Validation summary (post demo)
-- ---------------------------------------------------------------------------
create or replace function public.validate_business_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cash uuid;
  v_upi uuid;
  v_bank uuid;
  v_sales_sub numeric;
  v_cogs numeric;
  v_exp numeric;
  v_neg_batches int;
  v_neg_movements int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select id into v_cash from public.financial_accounts where user_id = v_user and account_type = 'cash';
  select id into v_upi from public.financial_accounts where user_id = v_user and account_type = 'upi';
  select id into v_bank from public.financial_accounts where user_id = v_user and account_type = 'bank';

  select coalesce(sum(subtotal),0), coalesce(sum(total_cogs),0)
  into v_sales_sub, v_cogs from public.sales where user_id = v_user;

  select coalesce(sum(amount),0) into v_exp from public.expenses where user_id = v_user;

  select count(*) into v_neg_batches from public.purchase_batches
  where user_id = v_user and remaining_quantity < 0;

  select count(*) into v_neg_movements from public.production_batches
  where user_id = v_user and remaining_bulk_litres < 0;

  return jsonb_build_object(
    'purchase_total', (select coalesce(sum(total_amount),0) from public.purchase_transactions where user_id = v_user),
    'sales_subtotal', v_sales_sub,
    'sales_total', (select coalesce(sum(total_amount),0) from public.sales where user_id = v_user),
    'expenses_total', v_exp,
    'cogs', v_cogs,
    'gross_profit', v_sales_sub - v_cogs,
    'net_profit', v_sales_sub - v_cogs - v_exp,
    'cash_balance', public.get_account_balance(v_cash),
    'upi_balance', public.get_account_balance(v_upi),
    'bank_balance', public.get_account_balance(v_bank),
    'negative_purchase_batches', v_neg_batches,
    'negative_bulk_batches', v_neg_movements,
    'expiry_alerts', (
      select count(*) from public.purchase_batches pb
      where pb.user_id = v_user and pb.remaining_quantity > 0 and pb.expiry_date <= current_date + 30
    ) + (
      select count(*) from public.production_batches pb
      where pb.user_id = v_user and pb.remaining_bulk_litres > 0 and pb.expiry_date <= current_date + 30
    )
  );
end;
$$;

grant execute on function public.validate_business_data() to authenticated;

-- Retail packed commodity sale from raw material batches (coffee / jaggery powder)
create or replace function public.demo_sell_packed_commodity(
  p_sale_date date,
  p_raw_material_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_financial_account_id uuid,
  p_idempotency_key text,
  p_reference_no text,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid;
  v_need numeric := p_quantity;
  v_pb record;
  v_take numeric;
  v_unit_cost numeric := 0;
  v_cogs numeric := 0;
  v_total numeric;
  v_line_total numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.sales where user_id = v_user and idempotency_key = p_idempotency_key) then
    return (select id from public.sales where user_id = v_user and idempotency_key = p_idempotency_key limit 1);
  end if;

  v_line_total := p_quantity * p_unit_price;
  v_total := v_line_total;

  insert into public.sales (
    user_id, customer_id, sale_date, reference_no, idempotency_key,
    subtotal, discount, total_amount, total_cogs, financial_account_id
  ) values (
    v_user, p_customer_id, p_sale_date, p_reference_no, p_idempotency_key,
    v_line_total, 0, v_total, 0, p_financial_account_id
  ) returning id into v_sale_id;

  for v_pb in
    select * from public.purchase_batches
    where user_id = v_user and raw_material_id = p_raw_material_id
      and remaining_quantity > 0 and expiry_date >= p_sale_date
    order by expiry_date, purchase_date
  loop
    exit when v_need <= 0;
    v_take := least(v_need, v_pb.remaining_quantity);
    update public.purchase_batches set remaining_quantity = remaining_quantity - v_take where id = v_pb.id;
    v_cogs := v_cogs + (v_take * v_pb.unit_cost);
    insert into public.stock_movements (
      user_id, movement_date, direction, item_type, raw_material_id, purchase_batch_id,
      quantity, unit_cost, reference_kind, reference_id
    ) values (
      v_user, p_sale_date, 'out', 'raw_material', p_raw_material_id, v_pb.id,
      v_take, v_pb.unit_cost, 'sale', v_sale_id
    );
    v_need := v_need - v_take;
  end loop;

  if v_need > 0.001 then
    raise exception 'Insufficient non-expired stock for commodity sale';
  end if;

  v_unit_cost := case when p_quantity > 0 then v_cogs / p_quantity else 0 end;

  insert into public.sale_items (
    user_id, sale_id, product_id, is_bulk_sale, quantity, unit_price, line_total, unit_cost, line_cogs
  ) values (
    v_user, v_sale_id, p_product_id, false, p_quantity, p_unit_price, v_line_total, v_unit_cost, v_cogs
  );

  update public.sales set total_cogs = v_cogs where id = v_sale_id;

  insert into public.financial_transactions (
    user_id, financial_account_id, transaction_date, direction, amount, reference_kind, reference_id, description
  ) values (
    v_user, p_financial_account_id, p_sale_date, 'in', v_total, 'sale', v_sale_id, 'Sale'
  );

  return v_sale_id;
end;
$$;

grant execute on function public.demo_sell_packed_commodity(date, uuid, uuid, numeric, numeric, uuid, text, text, uuid) to authenticated;

-- Waste / cake sale from a production batch (kg)
create or replace function public.demo_sell_waste(
  p_sale_date date,
  p_product_id uuid,
  p_production_batch_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_financial_account_id uuid,
  p_idempotency_key text,
  p_reference_no text,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid;
  v_available numeric;
  v_line_total numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.sales where user_id = v_user and idempotency_key = p_idempotency_key) then
    return (select id from public.sales where user_id = v_user and idempotency_key = p_idempotency_key limit 1);
  end if;

  select coalesce(sum(case when direction = 'in' then quantity else -quantity end), 0)
  into v_available
  from public.stock_movements
  where user_id = v_user and item_type = 'waste' and product_id = p_product_id
    and production_batch_id = p_production_batch_id;

  if v_available < p_quantity then
    raise exception 'Insufficient waste stock on batch';
  end if;

  v_line_total := p_quantity * p_unit_price;

  insert into public.sales (
    user_id, customer_id, sale_date, reference_no, idempotency_key,
    subtotal, discount, total_amount, total_cogs, financial_account_id
  ) values (
    v_user, p_customer_id, p_sale_date, p_reference_no, p_idempotency_key,
    v_line_total, 0, v_line_total, 0, p_financial_account_id
  ) returning id into v_sale_id;

  insert into public.stock_movements (
    user_id, movement_date, direction, item_type, product_id, production_batch_id,
    quantity, unit_cost, reference_kind, reference_id
  ) values (
    v_user, p_sale_date, 'out', 'waste', p_product_id, p_production_batch_id,
    p_quantity, 0, 'sale', v_sale_id
  );

  insert into public.sale_items (
    user_id, sale_id, product_id, production_batch_id, is_bulk_sale,
    quantity, unit_price, line_total, unit_cost, line_cogs
  ) values (
    v_user, v_sale_id, p_product_id, p_production_batch_id, false,
    p_quantity, p_unit_price, v_line_total, 0, 0
  );

  insert into public.financial_transactions (
    user_id, financial_account_id, transaction_date, direction, amount, reference_kind, reference_id, description
  ) values (
    v_user, p_financial_account_id, p_sale_date, 'in', v_line_total, 'sale', v_sale_id, 'Sale'
  );

  return v_sale_id;
end;
$$;

grant execute on function public.demo_sell_waste(date, uuid, uuid, numeric, numeric, uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7-day demo loader (12 Sep 2026 – 18 Sep 2026)
-- ---------------------------------------------------------------------------
create or replace function public.load_seven_day_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cash uuid;
  v_upi uuid;
  v_bank uuid;
  v_sesame_seed uuid;
  v_coconut uuid;
  v_groundnut uuid;
  v_coffee_rm uuid;
  v_jaggery_rm uuid;
  v_sesame_oil uuid;
  v_coconut_oil uuid;
  v_groundnut_oil uuid;
  v_coffee_prod uuid;
  v_jaggery_prod uuid;
  v_sesame_cake uuid;
  v_coconut_cake uuid;
  v_groundnut_cake uuid;
  v_recipe_sesame uuid;
  v_recipe_coconut uuid;
  v_recipe_groundnut uuid;
  v_sup1 uuid;
  v_sup2 uuid;
  v_cust_retail uuid;
  v_cust_wh1 uuid;
  v_cust_wh2 uuid;
  v_cat_labour uuid;
  v_cat_elec uuid;
  v_cat_petrol uuid;
  v_cat_maint uuid;
  v_cat_other uuid;
  v_pb_sesame uuid;
  v_pb_coconut uuid;
  v_pb_groundnut uuid;
  v_prod_sesame uuid;
  v_prod_coconut uuid;
  v_prod_groundnut uuid;
  v_pkg_500 uuid;
  v_pkg_1l uuid;
  v_pkg_5l uuid;
  v_pkg_gnd_500 uuid;
  v_sale_id uuid;
  v_i int;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if exists (
    select 1 from public.business_settings
    where user_id = v_user and demo_data_loaded_at is not null
  ) then
    raise exception 'Demo data already loaded. Clear business data first.';
  end if;

  perform public.seed_default_business_data();

  select id into v_cash from public.financial_accounts where user_id = v_user and account_type = 'cash';
  select id into v_upi from public.financial_accounts where user_id = v_user and account_type = 'upi';
  select id into v_bank from public.financial_accounts where user_id = v_user and account_type = 'bank';

  select id into v_sesame_seed from public.raw_materials where user_id = v_user and code = 'SES-SEED';
  select id into v_coconut from public.raw_materials where user_id = v_user and code = 'COC-NUT';
  select id into v_groundnut from public.raw_materials where user_id = v_user and code = 'GND-NUT';
  select id into v_coffee_rm from public.raw_materials where user_id = v_user and code = 'COF-RM';
  select id into v_jaggery_rm from public.raw_materials where user_id = v_user and code = 'JAG-RM';

  select id into v_sesame_oil from public.products where user_id = v_user and code = 'SES-OIL';
  select id into v_coconut_oil from public.products where user_id = v_user and code = 'COC-OIL';
  select id into v_groundnut_oil from public.products where user_id = v_user and code = 'GND-OIL';
  select id into v_coffee_prod from public.products where user_id = v_user and code = 'COF-PWD';
  select id into v_jaggery_prod from public.products where user_id = v_user and code = 'JAG-PWD';
  select id into v_sesame_cake from public.products where user_id = v_user and code = 'SES-CAKE';
  select id into v_coconut_cake from public.products where user_id = v_user and code = 'COC-CAKE';
  select id into v_groundnut_cake from public.products where user_id = v_user and code = 'GND-CAKE';

  select id into v_recipe_sesame from public.recipes where user_id = v_user and output_product_id = v_sesame_oil limit 1;
  select id into v_recipe_coconut from public.recipes where user_id = v_user and output_product_id = v_coconut_oil limit 1;
  select id into v_recipe_groundnut from public.recipes where user_id = v_user and output_product_id = v_groundnut_oil limit 1;

  insert into public.suppliers (user_id, name, phone)
  values (v_user, 'Murugan Traders', '9876500001')
  returning id into v_sup1;
  insert into public.suppliers (user_id, name, phone)
  values (v_user, 'Coastal Agro', '9876500002')
  returning id into v_sup2;

  insert into public.customers (user_id, name, phone, address, customer_type) values
    (v_user, 'Walk-in Retail', null, null, 'retail')
  returning id into v_cust_retail;
  insert into public.customers (user_id, name, phone, address, customer_type) values
    (v_user, 'Anand Stores', '9840011111', 'Shop: Anand Stores' || E'\n' || 'Gandhipuram', 'wholesale')
  returning id into v_cust_wh1;
  insert into public.customers (user_id, name, phone, address, customer_type) values
    (v_user, 'Priya Provisions', '9840022222', 'Shop: Priya Provisions' || E'\n' || 'RS Puram', 'wholesale')
  returning id into v_cust_wh2;

  insert into public.expense_categories (user_id, name) values
    (v_user, 'Petrol'), (v_user, 'Other')
  on conflict (user_id, name) do nothing;

  select id into v_cat_labour from public.expense_categories where user_id = v_user and name = 'Labour';
  select id into v_cat_elec from public.expense_categories where user_id = v_user and name = 'Electricity';
  select id into v_cat_maint from public.expense_categories where user_id = v_user and name = 'Maintenance';
  select id into v_cat_petrol from public.expense_categories where user_id = v_user and name = 'Petrol';
  select id into v_cat_other from public.expense_categories where user_id = v_user and name = 'Other';

  update public.products set retail_price = 320, wholesale_price = 290 where id = v_sesame_oil;
  update public.products set retail_price = 280, wholesale_price = 250 where id = v_coconut_oil;
  update public.products set retail_price = 300, wholesale_price = 270 where id = v_groundnut_oil;
  update public.products set retail_price = 450, wholesale_price = 400 where id = v_coffee_prod;
  update public.products set retail_price = 120, wholesale_price = 100 where id = v_jaggery_prod;
  update public.products set retail_price = 40, wholesale_price = 35 where id = v_sesame_cake;

  insert into public.price_history (user_id, product_id, price_type, old_value, new_value)
  values (v_user, v_sesame_oil, 'retail', 0, 320);

  -- Purchases (12–14 Sep) with mixed expiry
  perform public.record_purchase(jsonb_build_object(
    'transaction_date','2026-09-12','financial_account_id',v_bank,'idempotency_key','demo-pur-1',
    'supplier_id',v_sup1,
    'lines', jsonb_build_array(
      jsonb_build_object('raw_material_id',v_sesame_seed,'quantity',80,'unit_cost',200,'purchase_date','2026-09-12','expiry_date','2027-03-01'),
      jsonb_build_object('raw_material_id',v_jaggery_rm,'quantity',10,'unit_cost',90,'purchase_date','2026-09-12','expiry_date','2027-01-01')
    )
  ));

  perform public.record_purchase(jsonb_build_object(
    'transaction_date','2026-09-12','financial_account_id',v_cash,'idempotency_key','demo-pur-2',
    'supplier_id',v_sup2,
    'lines', jsonb_build_array(
      jsonb_build_object('raw_material_id',v_sesame_seed,'quantity',50,'unit_cost',300,'purchase_date','2026-09-12','expiry_date','2026-10-10'),
      jsonb_build_object('raw_material_id',v_coconut,'quantity',120,'unit_cost',35,'purchase_date','2026-09-12','expiry_date','2026-10-05')
    )
  ));

  -- Expired + alert batches (remaining stock for alerts only)
  perform public.record_purchase(jsonb_build_object(
    'transaction_date','2026-09-13','financial_account_id',v_upi,'idempotency_key','demo-pur-3',
    'lines', jsonb_build_array(
      jsonb_build_object('raw_material_id',v_groundnut,'quantity',60,'unit_cost',110,'purchase_date','2026-09-13','expiry_date','2027-06-01'),
      jsonb_build_object('raw_material_id',v_groundnut,'quantity',20,'unit_cost',115,'purchase_date','2026-09-13','expiry_date','2026-09-10'),
      jsonb_build_object('raw_material_id',v_coconut,'quantity',30,'unit_cost',36,'purchase_date','2026-09-13','expiry_date','2026-09-25'),
      jsonb_build_object('raw_material_id',v_sesame_seed,'quantity',25,'unit_cost',210,'purchase_date','2026-09-13','expiry_date','2026-09-22')
    )
  ));

  perform public.record_purchase(jsonb_build_object(
    'transaction_date','2026-09-14','financial_account_id',v_bank,'idempotency_key','demo-pur-4',
    'lines', jsonb_build_array(
      jsonb_build_object('raw_material_id',v_coffee_rm,'quantity',40,'unit_cost',380,'purchase_date','2026-09-14','expiry_date','2027-09-14'),
      jsonb_build_object('raw_material_id',v_jaggery_rm,'quantity',25,'unit_cost',95,'purchase_date','2026-09-14','expiry_date','2026-10-01'),
      jsonb_build_object('raw_material_id',v_groundnut,'quantity',50,'unit_cost',108,'purchase_date','2026-09-14','expiry_date','2026-09-28')
    )
  ));

  -- Production (uses FEFO; skips expired batches)
  v_prod_sesame := public.record_production(jsonb_build_object(
    'recipe_id', v_recipe_sesame, 'production_date','2026-09-13', 'expiry_date','2027-03-13',
    'oil_output_litres', 32, 'waste_output_kg', 44, 'labour_cost', 800, 'electricity_cost', 450,
    'idempotency_key','demo-prod-sesame-1'
  ));

  v_prod_coconut := public.record_production(jsonb_build_object(
    'recipe_id', v_recipe_coconut, 'production_date','2026-09-14', 'expiry_date','2027-03-14',
    'oil_output_litres', 48, 'waste_output_kg', 24, 'labour_cost', 900, 'electricity_cost', 500,
    'idempotency_key','demo-prod-coconut-1'
  ));

  v_prod_groundnut := public.record_production(jsonb_build_object(
    'recipe_id', v_recipe_groundnut, 'production_date','2026-09-15', 'expiry_date','2027-03-15',
    'oil_output_litres', 28, 'waste_output_kg', 35, 'labour_cost', 750, 'electricity_cost', 420,
    'idempotency_key','demo-prod-gnd-1'
  ));

  select pp.id into v_pkg_500 from public.product_packages pp
  where pp.user_id = v_user and pp.product_id = v_sesame_oil and pp.size_ml = 500 limit 1;
  select pp.id into v_pkg_1l from public.product_packages pp
  where pp.user_id = v_user and pp.product_id = v_coconut_oil and pp.size_ml = 1000 limit 1;
  select pp.id into v_pkg_5l from public.product_packages pp
  where pp.user_id = v_user and pp.product_id = v_groundnut_oil and pp.size_ml = 5000 limit 1;
  select pp.id into v_pkg_gnd_500 from public.product_packages pp
  where pp.user_id = v_user and pp.product_id = v_groundnut_oil and pp.size_ml = 500 limit 1;

  perform public.record_bottling(jsonb_build_object(
    'production_batch_id', v_prod_sesame, 'product_package_id', v_pkg_500,
    'package_count', 40, 'transaction_date','2026-09-14', 'idempotency_key','demo-bottle-1'
  ));
  perform public.record_bottling(jsonb_build_object(
    'production_batch_id', v_prod_coconut, 'product_package_id', v_pkg_1l,
    'package_count', 30, 'transaction_date','2026-09-15', 'idempotency_key','demo-bottle-2'
  ));
  perform public.record_bottling(jsonb_build_object(
    'production_batch_id', v_prod_groundnut, 'product_package_id', v_pkg_5l,
    'package_count', 4, 'transaction_date','2026-09-16', 'idempotency_key','demo-bottle-3'
  ));
  perform public.record_bottling(jsonb_build_object(
    'production_batch_id', v_prod_groundnut, 'product_package_id', v_pkg_gnd_500,
    'package_count', 12, 'transaction_date','2026-09-16', 'idempotency_key','demo-bottle-4'
  ));

  -- Sales 12–17 (smaller)
  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-12','financial_account_id',v_cash,'reference_no','BILL-20260912-0001','idempotency_key','demo-sale-1',
    'customer_id',v_cust_retail,
    'lines', jsonb_build_array(jsonb_build_object(
      'product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,
      'quantity',2,'unit_price',320,'is_bulk_sale',false
    ))
  ));

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-13','financial_account_id',v_upi,'reference_no','BILL-20260913-0001','idempotency_key','demo-sale-2',
    'customer_id',v_cust_wh1,
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_coconut_oil,'product_package_id',v_pkg_1l,'production_batch_id',v_prod_coconut,'quantity',3,'unit_price',250,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,'quantity',2,'unit_price',290,'is_bulk_sale',false)
    )
  ));

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-14','financial_account_id',v_cash,'reference_no','BILL-20260914-0001','idempotency_key','demo-sale-4',
    'lines', jsonb_build_array(jsonb_build_object(
      'product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,
      'quantity',1,'unit_price',320,'is_bulk_sale',false
    ))
  ));

  perform public.demo_sell_packed_commodity(
    '2026-09-14', v_coffee_rm, v_coffee_prod, 2, 450, v_cash, 'demo-sale-coffee-1', 'BILL-20260914-0002', v_cust_retail
  );

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-15','financial_account_id',v_bank,'reference_no','BILL-20260915-0001','idempotency_key','demo-sale-3',
    'customer_id',v_cust_wh2,
    'lines', jsonb_build_array(jsonb_build_object(
      'product_id',v_groundnut_oil,'product_package_id',v_pkg_5l,'production_batch_id',v_prod_groundnut,
      'quantity',1,'unit_price',270,'is_bulk_sale',false
    ))
  ));

  perform public.demo_sell_packed_commodity(
    '2026-09-16', v_jaggery_rm, v_jaggery_prod, 3, 120, v_upi, 'demo-sale-jaggery-16', 'BILL-20260916-0001', v_cust_retail
  );
  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-16','financial_account_id',v_cash,'reference_no','BILL-20260916-0002','idempotency_key','demo-sale-16-2',
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,'quantity',1,'unit_price',320,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_coconut_oil,'product_package_id',v_pkg_1l,'production_batch_id',v_prod_coconut,'quantity',1,'unit_price',280,'is_bulk_sale',false)
    )
  ));

  perform public.demo_sell_waste(
    '2026-09-17', v_sesame_cake, v_prod_sesame, 10, 40, v_cash, 'demo-sale-cake-17', 'BILL-20260917-0001', v_cust_wh1
  );
  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-17','financial_account_id',v_bank,'reference_no','BILL-20260917-0002','idempotency_key','demo-sale-17-2',
    'customer_id',v_cust_wh2,
    'lines', jsonb_build_array(jsonb_build_object(
      'product_id',v_groundnut_oil,'product_package_id',v_pkg_gnd_500,'production_batch_id',v_prod_groundnut,
      'quantity',2,'unit_price',300,'is_bulk_sale',false
    ))
  ));

  -- Coffee / jaggery: raw material out + sale (demo-only helper pattern)
  perform public.record_purchase(jsonb_build_object(
    'transaction_date','2026-09-16','financial_account_id',v_cash,'idempotency_key','demo-pur-5',
    'lines', jsonb_build_array(
      jsonb_build_object('raw_material_id',v_coffee_rm,'quantity',5,'unit_cost',380,'purchase_date','2026-09-16','expiry_date','2027-09-16'),
      jsonb_build_object('raw_material_id',v_jaggery_rm,'quantity',8,'unit_cost',95,'purchase_date','2026-09-16','expiry_date','2027-03-16')
    )
  ));

  -- 18 Sep: ~20 units across multiple bills (5 multi-item)
  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-18','financial_account_id',v_cash,'reference_no','BILL-20260918-0001','idempotency_key','demo-sale-18-1',
    'customer_id',v_cust_retail,
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,'quantity',2,'unit_price',320,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_coconut_oil,'product_package_id',v_pkg_1l,'production_batch_id',v_prod_coconut,'quantity',1,'unit_price',280,'is_bulk_sale',false)
    )
  ));

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-18','financial_account_id',v_upi,'reference_no','BILL-20260918-0002','idempotency_key','demo-sale-18-2',
    'customer_id',v_cust_wh1,
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_coconut_oil,'product_package_id',v_pkg_1l,'production_batch_id',v_prod_coconut,'quantity',2,'unit_price',250,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_groundnut_oil,'product_package_id',v_pkg_gnd_500,'production_batch_id',v_prod_groundnut,'quantity',2,'unit_price',300,'is_bulk_sale',false)
    )
  ));

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-18','financial_account_id',v_bank,'reference_no','BILL-20260918-0003','idempotency_key','demo-sale-18-3',
    'customer_id',v_cust_wh2,
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_groundnut_oil,'product_package_id',v_pkg_5l,'production_batch_id',v_prod_groundnut,'quantity',1,'unit_price',270,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,'quantity',3,'unit_price',320,'is_bulk_sale',false)
    )
  ));

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-18','financial_account_id',v_cash,'reference_no','BILL-20260918-0004','idempotency_key','demo-sale-18-4',
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,'quantity',2,'unit_price',320,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_coconut_oil,'is_bulk_sale',true,'production_batch_id',v_prod_coconut,'quantity',2,'unit_price',250)
    )
  ));

  perform public.demo_sell_packed_commodity(
    '2026-09-18', v_jaggery_rm, v_jaggery_prod, 2, 120, v_upi, 'demo-sale-jaggery-18', 'BILL-20260918-0005', v_cust_retail
  );
  perform public.demo_sell_packed_commodity(
    '2026-09-18', v_coffee_rm, v_coffee_prod, 1, 450, v_bank, 'demo-sale-coffee-18', 'BILL-20260918-0006', v_cust_wh2
  );
  perform public.demo_sell_waste(
    '2026-09-18', v_groundnut_cake, v_prod_groundnut, 5, 35, v_cash, 'demo-sale-cake-18', 'BILL-20260918-0008', v_cust_retail
  );

  perform public.record_sale(jsonb_build_object(
    'sale_date','2026-09-18','financial_account_id',v_upi,'reference_no','BILL-20260918-0007','idempotency_key','demo-sale-18-7',
    'customer_id',v_cust_retail,
    'lines', jsonb_build_array(
      jsonb_build_object('product_id',v_groundnut_oil,'product_package_id',v_pkg_gnd_500,'production_batch_id',v_prod_groundnut,'quantity',2,'unit_price',300,'is_bulk_sale',false),
      jsonb_build_object('product_id',v_sesame_oil,'product_package_id',v_pkg_500,'production_batch_id',v_prod_sesame,'quantity',1,'unit_price',320,'is_bulk_sale',false)
    )
  ));

  -- Expenses across 7 days
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-12','amount',1200,'expense_category_id',v_cat_labour,'financial_account_id',v_cash,'idempotency_key','demo-exp-1','description','Helper wages'));
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-13','amount',850,'expense_category_id',v_cat_elec,'financial_account_id',v_upi,'idempotency_key','demo-exp-2','description','Mill electricity'));
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-14','amount',600,'expense_category_id',v_cat_petrol,'financial_account_id',v_cash,'idempotency_key','demo-exp-3','description','Delivery petrol'));
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-15','amount',1500,'expense_category_id',v_cat_labour,'financial_account_id',v_bank,'idempotency_key','demo-exp-4','description','Extra labour'));
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-16','amount',400,'expense_category_id',v_cat_maint,'financial_account_id',v_cash,'idempotency_key','demo-exp-5','description','Belt repair'));
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-17','amount',300,'expense_category_id',v_cat_other,'financial_account_id',v_upi,'idempotency_key','demo-exp-6','description','Misc shop'));
  perform public.record_expense(jsonb_build_object('expense_date','2026-09-18','amount',950,'expense_category_id',v_cat_elec,'financial_account_id',v_bank,'idempotency_key','demo-exp-7','description','Electricity'));

  update public.business_settings
  set demo_data_loaded_at = now(), demo_data_version = 'seven_day_v1', onboarding_completed = true,
      business_name = 'Kumar Oil Mill (Demo)', updated_at = now()
  where user_id = v_user;

  return public.validate_business_data();
end;
$$;

grant execute on function public.load_seven_day_demo_data() to authenticated;
