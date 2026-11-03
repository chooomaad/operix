-- ═══════════════════════════════════════════════════════════════════════════
-- OPERIX — backend Supabase (périmètre application mobile)
--
-- Les tables vivent dans le schéma privé `operix`, qui n'est PAS exposé par
-- l'API REST auto-générée de Supabase (PostgREST n'expose que `public` par
-- défaut). Seule l'Edge Function `api` y accède, via SUPABASE_DB_URL, et
-- applique elle-même l'isolation par entreprise (tenant) et les permissions.
-- RLS est tout de même activée sans aucune policy : défense en profondeur si
-- le schéma venait à être exposé par erreur.
--
-- Les identifiants sont des entiers (bigint) : l'application mobile les
-- manipule comme des nombres, comme avec l'ancienne API Laravel.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create schema if not exists operix;
revoke all on schema operix from public;
revoke all on schema operix from anon, authenticated;
grant usage on schema operix to service_role;

-- ── Entreprises (tenants) ──────────────────────────────────────────────────
create table operix.tenants (
  id             bigint generated always as identity primary key,
  slug           text not null unique,
  name           text not null,
  short_name     text,
  status         text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  logo_url       text,
  primary_color  text,
  locale         text default 'fr',
  country        text,
  timezone       text not null default 'UTC',
  settings       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- ── Utilisateurs applicatifs ───────────────────────────────────────────────
-- Le PIN n'est PAS stocké ici : c'est le mot de passe du compte Supabase Auth
-- lié (auth.users.encrypted_password, bcrypt). On gère donc les comptes depuis
-- le dashboard Supabase, et l'API vérifie le PIN avec crypt().
create table operix.users (
  id             bigint generated always as identity primary key,
  auth_user_id   uuid not null unique references auth.users (id) on delete cascade,
  tenant_id      bigint not null references operix.tenants (id) on delete cascade,
  name           text not null,
  email          text,
  role           text not null check (role in ('company_admin', 'hsse_manager', 'supervisor', 'agent')),
  matricule      text not null,
  phone          text,
  avatar         text,
  is_active      boolean not null default true,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
);
create unique index users_matricule_lower_idx on operix.users (lower(matricule));
create index users_tenant_idx on operix.users (tenant_id, role) where is_active;

-- ── Jetons d'API (équivalent Sanctum) ──────────────────────────────────────
-- On ne stocke que le SHA-256 du jeton : une fuite de la table ne donne accès
-- à aucune session. La déconnexion supprime la ligne : révocation immédiate.
create table operix.api_tokens (
  id            bigint generated always as identity primary key,
  user_id       bigint not null references operix.users (id) on delete cascade,
  token_hash    text not null unique,
  name          text not null default 'operix-mobile',
  last_used_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index api_tokens_user_idx on operix.api_tokens (user_id);

-- ── Limitation de débit (login, analyse IA) ────────────────────────────────
create table operix.rate_hits (
  key  text not null,
  at   timestamptz not null default now()
);
create index rate_hits_key_at_idx on operix.rate_hits (key, at);

-- ── Référentiel du personnel ───────────────────────────────────────────────
create table operix.departments (
  id          bigint generated always as identity primary key,
  tenant_id   bigint not null references operix.tenants (id) on delete cascade,
  name        text not null,
  code        text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create table operix.employees (
  id             bigint generated always as identity primary key,
  tenant_id      bigint not null references operix.tenants (id) on delete cascade,
  department_id  bigint references operix.departments (id) on delete set null,
  matricule      text,
  nom            text not null,
  prenom         text not null default '',
  poste          text,
  type_contrat   text,
  gender         text,
  date_embauche  date,
  nationalite    text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (tenant_id, matricule)
);
create index employees_tenant_idx on operix.employees (tenant_id, is_active);

-- ── Incidents ──────────────────────────────────────────────────────────────
create table operix.safety_incidents (
  id                     bigint generated always as identity primary key,
  tenant_id              bigint not null references operix.tenants (id) on delete cascade,
  reference              text not null,
  date                   date not null,
  time                   text,
  location               text not null,
  type                   text not null check (type in ('LTI', 'MTC', 'RWC', 'FAC', 'HPI', 'Fire', 'Security', 'Autre')),
  severity               text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description            text not null,
  immediate_cause        text,
  root_cause             text,
  corrective_action      text,
  corrective_action_due  date,
  status                 text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  image                  text,          -- chemin dans le bucket Storage `operix-media`
  latitude               double precision check (latitude between -90 and 90),
  longitude              double precision check (longitude between -180 and 180),
  location_accuracy      double precision check (location_accuracy >= 0),
  location_captured_at   timestamptz,
  reported_by            bigint references operix.users (id) on delete set null,
  ai_analysis            jsonb,         -- analyse figée au déploiement du plan d'actions
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  unique (tenant_id, reference),
  -- Une latitude sans longitude ne désigne aucun endroit.
  check ((latitude is null) = (longitude is null))
);
create index incidents_tenant_date_idx on operix.safety_incidents (tenant_id, date desc) where deleted_at is null;
create index incidents_tenant_status_idx on operix.safety_incidents (tenant_id, status) where deleted_at is null;

-- ── Presqu'accidents (near-miss) ───────────────────────────────────────────
create table operix.safety_near_miss (
  id                     bigint generated always as identity primary key,
  tenant_id              bigint not null references operix.tenants (id) on delete cascade,
  reference              text not null,
  date                   date not null,
  time                   text,
  location               text not null,
  severity               text not null check (severity in ('low', 'medium', 'high')),
  description            text not null,
  potential_consequence  text,
  corrective_action      text,
  corrective_action_due  date,
  status                 text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  image                  text,
  latitude               double precision check (latitude between -90 and 90),
  longitude              double precision check (longitude between -180 and 180),
  location_accuracy      double precision check (location_accuracy >= 0),
  location_captured_at   timestamptz,
  reported_by            bigint references operix.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  unique (tenant_id, reference),
  check ((latitude is null) = (longitude is null))
);
create index near_miss_tenant_date_idx on operix.safety_near_miss (tenant_id, date desc) where deleted_at is null;

-- ── Infractions (violations) ───────────────────────────────────────────────
create table operix.breaches (
  id           bigint generated always as identity primary key,
  tenant_id    bigint not null references operix.tenants (id) on delete cascade,
  reference    text not null,
  employee_id  bigint references operix.employees (id) on delete set null,
  location     text,
  date         date not null,
  type         text not null,
  severity     text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description  text not null,
  sanction     text,
  status       text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_by   bigint references operix.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (tenant_id, reference)
);
create index breaches_tenant_date_idx on operix.breaches (tenant_id, date desc) where deleted_at is null;

-- ── Plan d'actions des incidents (Operix AI ou manuel) ─────────────────────
create table operix.incident_actions (
  id                bigint generated always as identity primary key,
  tenant_id         bigint not null references operix.tenants (id) on delete cascade,
  incident_id       bigint not null references operix.safety_incidents (id) on delete cascade,
  position          integer not null default 0,
  description       text not null,
  priority          text not null check (priority in ('immediate', 'urgent', 'shift', 'prevention')),
  delay_minutes     integer check (delay_minutes between 0 and 43200),
  due_at            timestamptz,
  responsible_role  text,
  status            text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  source            text not null default 'manual' check (source in ('ai', 'rules', 'manual')),
  done_at           timestamptz,
  done_by           bigint references operix.users (id) on delete set null,
  created_by        bigint references operix.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index incident_actions_incident_idx on operix.incident_actions (incident_id, position);
create index incident_actions_tenant_status_idx on operix.incident_actions (tenant_id, status, due_at);

-- ── Notifications in-app ───────────────────────────────────────────────────
create table operix.notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   bigint not null references operix.tenants (id) on delete cascade,
  user_id     bigint not null references operix.users (id) on delete cascade,
  type        text not null default 'info',
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on operix.notifications (user_id, created_at desc);
create index notifications_unread_idx on operix.notifications (user_id) where read_at is null;

-- ── updated_at automatique ─────────────────────────────────────────────────
create or replace function operix.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch_incidents before update on operix.safety_incidents
  for each row execute function operix.touch_updated_at();
create trigger touch_near_miss before update on operix.safety_near_miss
  for each row execute function operix.touch_updated_at();
create trigger touch_breaches before update on operix.breaches
  for each row execute function operix.touch_updated_at();
create trigger touch_incident_actions before update on operix.incident_actions
  for each row execute function operix.touch_updated_at();

-- ── RLS : activée partout, aucune policy (accès réservé à l'Edge Function) ─
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'operix' loop
    execute format('alter table operix.%I enable row level security', t);
  end loop;
end $$;

grant all on all tables in schema operix to service_role;
grant all on all sequences in schema operix to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Création d'un compte (admin, superviseur, agent…) en une commande SQL.
-- Crée l'utilisateur Supabase Auth (mot de passe = PIN) ET son profil OPERIX.
--
--   select operix.create_user('tcn', 'TCN-ADM-001', 'MonPinSecret', 'Prénom Nom',
--                             'company_admin', 'admin@exemple.mr');
--
-- Réservée au rôle postgres / service_role (SQL editor du dashboard).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function operix.create_user(
  p_tenant_slug text,
  p_matricule   text,
  p_pin         text,
  p_name        text,
  p_role        text,
  p_email       text default null
) returns bigint
language plpgsql
security definer
set search_path = operix, auth, extensions, public
as $$
declare
  v_tenant  bigint;
  v_auth_id uuid := gen_random_uuid();
  v_email   text := lower(coalesce(nullif(trim(p_email), ''), lower(trim(p_matricule)) || '@users.operix.local'));
  v_user    bigint;
begin
  if length(coalesce(p_pin, '')) < 6 then
    raise exception 'Le PIN doit contenir au moins 6 caractères (exigence Supabase Auth).';
  end if;

  select id into v_tenant from operix.tenants where slug = p_tenant_slug;
  if v_tenant is null then
    raise exception 'Entreprise inconnue : %', p_tenant_slug;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
    v_email, crypt(p_pin, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', p_name, 'matricule', upper(trim(p_matricule))),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_auth_id, v_auth_id::text,
    jsonb_build_object('sub', v_auth_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into operix.users (auth_user_id, tenant_id, name, email, role, matricule, is_active)
  values (v_auth_id, v_tenant, p_name, nullif(trim(coalesce(p_email, '')), ''), p_role, upper(trim(p_matricule)), true)
  returning id into v_user;

  return v_user;
end $$;

revoke all on function operix.create_user(text, text, text, text, text, text) from public, anon, authenticated;
