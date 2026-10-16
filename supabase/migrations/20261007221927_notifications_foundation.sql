
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text,
  auth_key text,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
for all to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'general'
    check (type in ('new_arrival','promo','birthday','coupon','purchase','general')),
  coupon_code text,
  valid_until date,
  external_event_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from anon, authenticated;
grant select on public.app_notifications to authenticated;
grant update (read_at,updated_at) on public.app_notifications to authenticated;
grant delete on public.app_notifications to authenticated;
grant select, insert, update, delete on public.app_notifications to service_role;

drop policy if exists app_notifications_select_own on public.app_notifications;
create policy app_notifications_select_own on public.app_notifications
for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists app_notifications_update_own on public.app_notifications;
create policy app_notifications_update_own on public.app_notifications
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
drop policy if exists app_notifications_delete_own on public.app_notifications;
create policy app_notifications_delete_own on public.app_notifications
for delete to authenticated
using (user_id=(select auth.uid()));
create index if not exists app_notifications_user_id_idx on public.app_notifications(user_id);
create unique index if not exists app_notifications_event_user_unique
  on public.app_notifications(user_id, external_event_key)
  where external_event_key is not null;

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general'
    check (type in ('new_arrival','promo','birthday','coupon','general')),
  coupon_code text,
  discount_percent numeric,
  valid_until date,
  send_to_all boolean not null default false,
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','scheduled','sent','cancelled')),
  delivery_error text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_campaigns enable row level security;
grant select, insert, update, delete on public.notification_campaigns to authenticated;
grant select, insert, update, delete on public.notification_campaigns to service_role;
drop policy if exists notification_campaigns_select_member on public.notification_campaigns;
create policy notification_campaigns_select_member on public.notification_campaigns
for select to authenticated
using (private.has_business_permission(business_id, null));
drop policy if exists notification_campaigns_insert_sender on public.notification_campaigns;
create policy notification_campaigns_insert_sender on public.notification_campaigns
for insert to authenticated
with check (
  private.has_business_permission(business_id, 'send_notifications')
  and (created_by_user_id is null or created_by_user_id=(select auth.uid()))
);
drop policy if exists notification_campaigns_update_sender on public.notification_campaigns;
create policy notification_campaigns_update_sender on public.notification_campaigns
for update to authenticated
using (private.has_business_permission(business_id, 'send_notifications'))
with check (private.has_business_permission(business_id, 'send_notifications'));
drop policy if exists notification_campaigns_delete_sender on public.notification_campaigns;
create policy notification_campaigns_delete_sender on public.notification_campaigns
for delete to authenticated
using (private.has_business_permission(business_id, 'send_notifications'));
create index if not exists notification_campaigns_business_id_idx on public.notification_campaigns(business_id);

create table if not exists public.notification_campaign_targets (
  campaign_id uuid not null references public.notification_campaigns(id) on delete cascade,
  store_customer_id uuid not null references public.store_customers(id) on delete cascade,
  primary key (campaign_id, store_customer_id)
);
alter table public.notification_campaign_targets enable row level security;
grant select, insert, delete on public.notification_campaign_targets to authenticated;
grant select, insert, update, delete on public.notification_campaign_targets to service_role;
drop policy if exists notification_campaign_targets_member on public.notification_campaign_targets;
create policy notification_campaign_targets_member on public.notification_campaign_targets
for all to authenticated
using (exists (
  select 1 from public.notification_campaigns c
  where c.id=campaign_id and private.has_business_permission(c.business_id, 'send_notifications')
))
with check (exists (
  select 1 from public.notification_campaigns c
  where c.id=campaign_id and private.has_business_permission(c.business_id, 'send_notifications')
));

create table if not exists public.store_alerts (
  id uuid primary key default gen_random_uuid(),
  legacy_base44_id text unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete set null,
  customer_id uuid references public.store_customers(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'general'
    check (type in ('customer_entry','try_on_request','general')),
  external_event_key text,
  created_at timestamptz not null default now()
);
alter table public.store_alerts enable row level security;
grant select on public.store_alerts to authenticated;
grant select, insert, update, delete on public.store_alerts to service_role;
drop policy if exists store_alerts_select_member on public.store_alerts;
create policy store_alerts_select_member on public.store_alerts
for select to authenticated
using (private.has_business_permission(business_id, null));
create index if not exists store_alerts_business_id_idx on public.store_alerts(business_id);

create table if not exists public.store_alert_reads (
  alert_id uuid not null references public.store_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (alert_id,user_id)
);
alter table public.store_alert_reads enable row level security;
grant select, insert, delete on public.store_alert_reads to authenticated;
grant select, insert, update, delete on public.store_alert_reads to service_role;
drop policy if exists store_alert_reads_own on public.store_alert_reads;
create policy store_alert_reads_own on public.store_alert_reads
for all to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.store_alerts a
    where a.id=alert_id and private.has_business_permission(a.business_id, null)
  )
)
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.store_alerts a
    where a.id=alert_id and private.has_business_permission(a.business_id, null)
  )
);

create table if not exists private.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  app_notification_id uuid references public.app_notifications(id) on delete cascade,
  campaign_id uuid references public.notification_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null,
  provider_message_id text,
  status text not null default 'pending',
  error_message text,
  attempted_at timestamptz not null default now()
);
alter table private.notification_deliveries enable row level security;

create table if not exists private.base44_notification_staging (
  source_app text not null check (source_app in ('the_concierge','concierge_pro')),
  source_entity text not null check (source_entity in ('AppNotification','PushSubscription','CustomerNotification','StoreAlert')),
  legacy_id text not null,
  legacy_user_id text,
  legacy_business_id text,
  payload jsonb not null,
  migration_status text not null default 'staged'
    check (migration_status in ('staged','linked','cutover_complete','needs_review')),
  staged_at timestamptz not null default now(),
  primary key (source_app,source_entity,legacy_id)
);
alter table private.base44_notification_staging enable row level security;
