-- Oil Mill Management — core schema with RLS

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('cash', 'upi', 'bank');
create type public.stock_item_type as enum ('raw_material', 'bulk_oil', 'packaged', 'waste');
create type public.stock_direction as enum ('in', 'out');
create type public.financial_direction as enum ('in', 'out');
create type public.reference_kind as enum (
  'purchase',
  'production',
  'bottling',
  'sale',
  'expense',
  'adjustment',
  'opening'
);

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------
create table public.business_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default 'My Oil Mill',
  currency_code text not null default 'INR',
  onboarding_completed boolean not null default false,
  expiry_alert_days int[] not null default array[30, 15, 7],
  profit_target_percent numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null,
  unit text not null default 'L',
  retail_price numeric(12, 2) not null default 0,
  wholesale_price numeric(12, 2) not null default 0,
  active boolean not null default true,
  is_oil boolean not null default false,
  is_waste boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null,
  unit text not null default 'kg',
  default_price numeric(12, 2) not null default 0,
  shelf_life_days int not null default 180,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table public.product_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  label text not null,
  size_ml int,
  size_g int,
  packaging_cost numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  output_product_id uuid not null references public.products (id) on delete restrict,
  base_raw_material_id uuid not null references public.raw_materials (id) on delete restrict,
  base_raw_qty numeric(12, 3) not null default 10,
  expected_oil_litres numeric(12, 3) not null,
  expected_waste_kg numeric(12, 3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  raw_material_id uuid references public.raw_materials (id) on delete restrict,
  product_id uuid references public.products (id) on delete restrict,
  quantity numeric(12, 3) not null,
  unit text not null,
  created_at timestamptz not null default now(),
  check (raw_material_id is not null or product_id is not null)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  customer_type text not null default 'retail',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_type public.account_type not null,
  opening_balance numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_type)
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table public.purchase_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  transaction_date date not null default current_date,
  reference_no text,
  idempotency_key text,
  total_amount numeric(14, 2) not null default 0,
  notes text,
  financial_account_id uuid not null references public.financial_accounts (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.purchase_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purchase_transaction_id uuid not null references public.purchase_transactions (id) on delete cascade,
  raw_material_id uuid not null references public.raw_materials (id) on delete restrict,
  batch_code text not null,
  original_quantity numeric(14, 3) not null,
  remaining_quantity numeric(14, 3) not null,
  purchase_date date not null,
  expiry_date date not null,
  unit_cost numeric(12, 4) not null,
  created_at timestamptz not null default now(),
  check (remaining_quantity >= 0),
  check (remaining_quantity <= original_quantity)
);

create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete set null,
  output_product_id uuid not null references public.products (id) on delete restrict,
  production_date date not null default current_date,
  expiry_date date not null,
  oil_output_litres numeric(14, 3) not null,
  waste_output_kg numeric(14, 3) not null default 0,
  remaining_bulk_litres numeric(14, 3) not null,
  raw_material_cost numeric(14, 2) not null default 0,
  ingredient_cost numeric(14, 2) not null default 0,
  labour_cost numeric(14, 2) not null default 0,
  electricity_cost numeric(14, 2) not null default 0,
  overhead_cost numeric(14, 2) not null default 0,
  waste_value numeric(14, 2) not null default 0,
  effective_production_cost numeric(14, 2) not null,
  cost_per_litre numeric(12, 4) not null,
  idempotency_key text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (remaining_bulk_litres >= 0),
  check (remaining_bulk_litres <= oil_output_litres)
);

create table public.production_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  production_batch_id uuid not null references public.production_batches (id) on delete cascade,
  purchase_batch_id uuid references public.purchase_batches (id) on delete set null,
  raw_material_id uuid references public.raw_materials (id) on delete restrict,
  product_id uuid references public.products (id) on delete restrict,
  quantity numeric(14, 3) not null,
  unit_cost numeric(12, 4) not null,
  total_cost numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create table public.bottling_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  production_batch_id uuid not null references public.production_batches (id) on delete restrict,
  product_package_id uuid not null references public.product_packages (id) on delete restrict,
  transaction_date date not null default current_date,
  package_count int not null,
  bulk_litres_used numeric(14, 3) not null,
  packaging_cost_total numeric(14, 2) not null,
  idempotency_key text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (package_count > 0)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  sale_date date not null default current_date,
  reference_no text,
  idempotency_key text,
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  total_cogs numeric(14, 2) not null default 0,
  financial_account_id uuid not null references public.financial_accounts (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_package_id uuid references public.product_packages (id) on delete restrict,
  production_batch_id uuid references public.production_batches (id) on delete restrict,
  is_bulk_sale boolean not null default false,
  quantity numeric(14, 3) not null,
  unit_price numeric(12, 2) not null,
  line_total numeric(14, 2) not null,
  unit_cost numeric(12, 4) not null,
  line_cogs numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_category_id uuid not null references public.expense_categories (id) on delete restrict,
  expense_date date not null default current_date,
  amount numeric(14, 2) not null,
  description text,
  financial_account_id uuid not null references public.financial_accounts (id) on delete restrict,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts (id) on delete restrict,
  transaction_date date not null default current_date,
  direction public.financial_direction not null,
  amount numeric(14, 2) not null check (amount > 0),
  reference_kind public.reference_kind not null,
  reference_id uuid not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  movement_date date not null default current_date,
  direction public.stock_direction not null,
  item_type public.stock_item_type not null,
  product_id uuid references public.products (id) on delete restrict,
  raw_material_id uuid references public.raw_materials (id) on delete restrict,
  product_package_id uuid references public.product_packages (id) on delete restrict,
  purchase_batch_id uuid references public.purchase_batches (id) on delete set null,
  production_batch_id uuid references public.production_batches (id) on delete set null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_cost numeric(12, 4) not null default 0,
  reference_kind public.reference_kind not null,
  reference_id uuid not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.monthly_cost_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw_material_id uuid not null references public.raw_materials (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  total_quantity numeric(14, 3) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  weighted_avg_cost numeric(12, 4) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, raw_material_id, year, month)
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  raw_material_id uuid references public.raw_materials (id) on delete cascade,
  product_package_id uuid references public.product_packages (id) on delete cascade,
  price_type text not null,
  old_value numeric(12, 2),
  new_value numeric(12, 2) not null,
  changed_at timestamptz not null default now(),
  check (
    product_id is not null
    or raw_material_id is not null
    or product_package_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_products_user on public.products (user_id);
create index idx_raw_materials_user on public.raw_materials (user_id);
create index idx_stock_movements_user_date on public.stock_movements (user_id, movement_date);
create index idx_purchase_batches_fefo on public.purchase_batches (user_id, raw_material_id, expiry_date);
create index idx_production_batches_fefo on public.production_batches (user_id, output_product_id, expiry_date);
create index idx_sales_user_date on public.sales (user_id, sale_date);
create index idx_financial_tx_user_date on public.financial_transactions (user_id, transaction_date);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.business_settings enable row level security;
alter table public.products enable row level security;
alter table public.raw_materials enable row level security;
alter table public.product_packages enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.purchase_transactions enable row level security;
alter table public.purchase_batches enable row level security;
alter table public.production_batches enable row level security;
alter table public.production_inputs enable row level security;
alter table public.bottling_transactions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.stock_movements enable row level security;
alter table public.monthly_cost_summaries enable row level security;
alter table public.price_history enable row level security;

-- business_settings
create policy "business_settings_select" on public.business_settings for select using (auth.uid() = user_id);
create policy "business_settings_insert" on public.business_settings for insert with check (auth.uid() = user_id);
create policy "business_settings_update" on public.business_settings for update using (auth.uid() = user_id);

-- generic policies helper pattern for user-owned tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'raw_materials', 'product_packages', 'recipes', 'recipe_ingredients',
    'suppliers', 'customers', 'expense_categories', 'financial_accounts',
    'purchase_transactions', 'purchase_batches', 'production_batches', 'production_inputs',
    'bottling_transactions', 'sales', 'sale_items', 'expenses', 'financial_transactions',
    'stock_movements', 'monthly_cost_summaries', 'price_history'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id)',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_delete', t
    );
  end loop;
end $$;

-- Direct inserts to ledger tables from client are discouraged; RPCs use security definer.
-- Users may still read their own rows via RLS above.
