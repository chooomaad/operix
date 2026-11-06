-- À exécuter une seule fois après la migration 20261106000001_platform_admins.sql.
-- Remplacez le matricule fictif par celui de votre compte company_admin actif.
do $$
declare
  v_user_id bigint;
begin
  select id
    into v_user_id
    from operix.users
   where lower(matricule) = lower('REMPLACER_PAR_VOTRE_MATRICULE')
     and role = 'company_admin'
     and is_active;

  if v_user_id is null then
    raise exception 'Aucun compte company_admin actif ne correspond au matricule fourni.';
  end if;

  insert into operix.platform_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
end
$$;
