
create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_type text not null
    check (feature_type in ('recommendation','try_on','size_suggestion','style_match','fit_analysis','shopping_assistant','other')),
  product_master_id uuid references public.product_master(id) on delete set null,
  product_variant_id uuid references public.product_variant(id) on delete set null,
  input_context jsonb,
  output_summary jsonb,
  recommendation_confidence numeric
    check (recommendation_confidence is null or (recommendation_confidence >= 0 and recommendation_confidence <= 100)),
  model_provider text,
  model_name text,
  prompt_version text,
  created_at timestamptz not null default now()
);
alter table public.ai_interactions enable row level security;
grant select on public.ai_interactions to authenticated;
grant select, insert, update, delete on public.ai_interactions to service_role;
drop policy if exists ai_interactions_select_own on public.ai_interactions;
create policy ai_interactions_select_own on public.ai_interactions
for select to authenticated
using (user_id=(select auth.uid()));
create index if not exists ai_interactions_user_id_idx on public.ai_interactions(user_id);
create index if not exists ai_interactions_created_at_idx on public.ai_interactions(user_id,created_at desc);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  interaction_id uuid references public.ai_interactions(id) on delete set null,
  feedback_type text
    check (feedback_type is null or feedback_type in ('recommendation','try_on','size_suggestion','style_match')),
  product_master_id uuid references public.product_master(id) on delete set null,
  legacy_product_id text,
  rating integer check (rating is null or rating between 1 and 5),
  accuracy_rating integer check (accuracy_rating is null or accuracy_rating between 1 and 5),
  feedback_text text,
  was_helpful boolean,
  actual_outcome text,
  suggested_size text,
  actual_size_needed text,
  fit_result text
    check (fit_result is null or fit_result in ('too_tight','ideal','too_loose','mixed','not_tried')),
  problem_areas text[] not null default '{}'::text[],
  kept_item boolean,
  return_reason text,
  brand text,
  category text,
  recommendation_confidence numeric
    check (recommendation_confidence is null or (recommendation_confidence >= 0 and recommendation_confidence <= 100)),
  width_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_feedback enable row level security;
grant select, insert, update, delete on public.ai_feedback to authenticated;
grant select, insert, update, delete on public.ai_feedback to service_role;
drop policy if exists ai_feedback_own on public.ai_feedback;
create policy ai_feedback_own on public.ai_feedback
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
create index if not exists ai_feedback_user_id_idx on public.ai_feedback(user_id);
create index if not exists ai_feedback_interaction_id_idx on public.ai_feedback(interaction_id);

create table if not exists public.shopping_experiences (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  legacy_vendor_id text,
  vendor_name text,
  experience_type text check (experience_type is null or experience_type in ('online','in_store')),
  overall_rating integer check (overall_rating is null or overall_rating between 1 and 5),
  service_rating integer check (service_rating is null or service_rating between 1 and 5),
  app_experience_rating integer check (app_experience_rating is null or app_experience_rating between 1 and 5),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text,
  employee_rating integer check (employee_rating is null or employee_rating between 1 and 5),
  feedback_text text,
  would_return boolean,
  purchase_id uuid references public.purchases(id) on delete set null,
  legacy_purchase_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shopping_experiences enable row level security;
grant select, insert, update, delete on public.shopping_experiences to authenticated;
grant select, insert, update, delete on public.shopping_experiences to service_role;
drop policy if exists shopping_experiences_own on public.shopping_experiences;
create policy shopping_experiences_own on public.shopping_experiences
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
create index if not exists shopping_experiences_user_id_idx on public.shopping_experiences(user_id);
create index if not exists shopping_experiences_business_id_idx on public.shopping_experiences(business_id);

create table if not exists private.base44_ai_history_staging (
  source_entity text not null check (source_entity in ('AIFeedback','ShoppingExperience')),
  legacy_id text not null,
  legacy_user_id text,
  payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  primary key (source_entity,legacy_id)
);
alter table private.base44_ai_history_staging enable row level security;
