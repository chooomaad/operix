create table operix.sites (
  id          bigint generated always as identity primary key,
  tenant_id   bigint not null references operix.tenants (id) on delete cascade,
  name        text not null,
  code        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, name)
);

alter table operix.users
  add column first_name text not null default '',
  add column last_name text not null default '',
  add column site_id bigint;

update operix.users
   set first_name = split_part(name, ' ', 1),
       last_name = coalesce(nullif(substr(name, length(split_part(name, ' ', 1)) + 2), ''), '');

alter table operix.users
  add constraint users_site_tenant_fk
  foreign key (site_id, tenant_id)
  references operix.sites (id, tenant_id)
  on delete set null (site_id);

create index users_site_idx on operix.users (tenant_id, site_id, role);

alter table operix.sites enable row level security;
grant all on operix.sites to service_role;
grant all on sequence operix.sites_id_seq to service_role;
