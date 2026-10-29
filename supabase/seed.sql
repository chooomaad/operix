-- ═══════════════════════════════════════════════════════════════════════════
-- Données de démarrage — équivalent de DatabaseSeeder + DemoTenantSeeder.
--
-- `supabase db reset` exécute ce fichier en local. Pour un projet hébergé,
-- coller la partie voulue dans le SQL editor du dashboard.
--
-- ATTENTION : la partie « Demo Company » contient des PIN de démonstration
-- connus. Ne jamais l'exécuter sur la base de production.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Organisation TCN (aucun compte : créer l'admin avec operix.create_user) ─
insert into operix.tenants (slug, name, short_name, status, primary_color, country, timezone, locale)
values ('tcn', 'Terminal à Conteneurs de Nouakchott', 'TCN', 'active', '#0f2847', 'MR', 'Africa/Nouakchott', 'fr')
on conflict (slug) do nothing;

insert into operix.departments (tenant_id, name, code)
select t.id, d.name, d.code
from operix.tenants t
cross join (values
  ('Direction Générale', 'DG'), ('Opérations Portuaires', 'OPS'), ('HSSE', 'HSSE'),
  ('Maintenance', 'MAINT'), ('Ressources Humaines', 'RH'), ('Finance et Comptabilité', 'FIN'),
  ('Informatique', 'IT'), ('Commercial', 'COM'), ('Logistique', 'LOG'), ('Sécurité', 'SEC')
) as d(name, code)
where t.slug = 'tcn'
on conflict (tenant_id, name) do nothing;

-- ── Demo Company (développement et recette uniquement) ─────────────────────
insert into operix.tenants (slug, name, short_name, status, primary_color, country, timezone, locale)
values ('demo', 'Demo Company', 'DEMO', 'active', '#7c3aed', 'FR', 'Europe/Paris', 'fr')
on conflict (slug) do nothing;

do $$
begin
  if not exists (select 1 from operix.users where matricule = 'DEMO-ADM-001') then
    perform operix.create_user('demo', 'DEMO-ADM-001', 'Demo@2026', 'Amina Diallo',   'company_admin', 'admin@demo-company.test');
    perform operix.create_user('demo', 'DEMO-HSE-001', 'Demo@2026', 'Karim Benali',   'hsse_manager',  'hse.manager@demo-company.test');
    perform operix.create_user('demo', 'DEMO-SUP-001', 'Demo@2026', 'Lucie Moreau',   'supervisor',    'supervisor@demo-company.test');
    perform operix.create_user('demo', 'DEMO-AGT-001', 'Demo@2026', 'Ousmane Traore', 'agent',         'agent@demo-company.test');
  end if;
end $$;

insert into operix.departments (tenant_id, name, code)
select t.id, d.name, d.code
from operix.tenants t
cross join (values ('Exploitation', 'EXP'), ('Maintenance', 'MNT'), ('QHSE', 'QHSE')) as d(name, code)
where t.slug = 'demo'
on conflict (tenant_id, name) do nothing;

insert into operix.employees (tenant_id, department_id, matricule, nom, prenom, poste, type_contrat, date_embauche, is_active)
select t.id, d.id, e.matricule, e.nom, e.prenom, e.poste, 'CDI', (current_date - interval '2 years')::date, true
from operix.tenants t
cross join (values
  ('DEMO-E-001', 'Sow',    'Fatimata', 'Cariste',          'Exploitation'),
  ('DEMO-E-002', 'Ndiaye', 'Ibrahima', 'Technicien',       'Maintenance'),
  ('DEMO-E-003', 'Leroy',  'Camille',  'Responsable QHSE', 'QHSE'),
  ('DEMO-E-004', 'Barry',  'Aissatou', 'Operatrice',       'Exploitation')
) as e(matricule, nom, prenom, poste, dept)
join operix.departments d on d.name = e.dept
where t.slug = 'demo' and d.tenant_id = t.id
on conflict (tenant_id, matricule) do nothing;

insert into operix.safety_incidents (tenant_id, reference, date, location, type, severity, description, status, reported_by)
select t.id, 'INC-DEMO-0001', current_date - 12, 'Atelier maintenance', 'MTC', 'medium',
       'Coupure à la main lors du remplacement d''une pièce.', 'open', u.id
from operix.tenants t
join operix.users u on u.matricule = 'DEMO-ADM-001'
where t.slug = 'demo'
on conflict (tenant_id, reference) do nothing;

insert into operix.safety_near_miss (tenant_id, reference, date, location, severity, description, potential_consequence, status, reported_by)
select t.id, 'NM-DEMO-0001', current_date - 5, 'Zone de chargement', 'high',
       'Palette instable sur un rayonnage en hauteur.',
       'Chute de charge sur zone de circulation piétonne.', 'open', u.id
from operix.tenants t
join operix.users u on u.matricule = 'DEMO-ADM-001'
where t.slug = 'demo'
on conflict (tenant_id, reference) do nothing;
