
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  friend_name text,
  friend_picture text,
  requester_name text,
  requester_picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, friend_user_id)
);
alter table public.friends enable row level security;
create policy "friends_read_own" on public.friends for select to authenticated using (user_id=auth.uid() or friend_user_id=auth.uid());
create policy "friends_insert_own" on public.friends for insert to authenticated with check (user_id=auth.uid());
create policy "friends_update_own" on public.friends for update to authenticated using (user_id=auth.uid() or friend_user_id=auth.uid());
create policy "friends_delete_own" on public.friends for delete to authenticated using (user_id=auth.uid() or friend_user_id=auth.uid());

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_master_id uuid references public.product_master(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  fit_rating text,
  quality_rating integer,
  value_rating integer,
  would_recommend boolean,
  photos jsonb not null default '[]'::jsonb,
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_reviews enable row level security;
create policy "product_reviews_public_read" on public.product_reviews for select using (true);
create policy "product_reviews_insert_own" on public.product_reviews for insert to authenticated with check (user_id=auth.uid());
create policy "product_reviews_update_own" on public.product_reviews for update to authenticated using (user_id=auth.uid());
create policy "product_reviews_delete_own" on public.product_reviews for delete to authenticated using (user_id=auth.uid());

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  pay_period_start date,
  pay_period_end date,
  regular_hours numeric not null default 0,
  overtime_hours numeric not null default 0,
  gross_pay numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payroll_records enable row level security;
create policy "payroll_manager_read" on public.payroll_records for select to authenticated using (private.has_business_permission(business_id,'view_payroll'));
create policy "payroll_manager_write" on public.payroll_records for all to authenticated using (private.has_business_permission(business_id,'view_payroll')) with check (private.has_business_permission(business_id,'view_payroll'));
