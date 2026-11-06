create table operix.platform_admins (
  user_id bigint primary key references operix.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table operix.platform_admins enable row level security;
revoke all on operix.platform_admins from public, anon, authenticated;
grant select, insert, update, delete on operix.platform_admins to service_role;
