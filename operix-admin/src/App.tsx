import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  ROLE_LABELS,
  ROLES,
  createUser,
  getPlatformCompanies,
  getUsers,
  login,
  logout,
  setAccessToken,
  updateUser,
} from './api';
import type { AdminSession, AdminUser, Company, Site, UserForm } from './api';
import Companies from './Companies';
import Employees from './Employees';
import Incidents from './Incidents';
import Records from './Records';

const EMPTY_FORM: UserForm = {
  first_name: '',
  last_name: '',
  matricule: '',
  pin: '',
  pin_confirmation: '',
  role: 'agent',
  site_id: '',
  is_active: true,
};

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}

function UserDialog({
  user,
  sites,
  onClose,
  onSave,
}: {
  user: AdminUser | null;
  sites: Site[];
  onClose: () => void;
  onSave: (form: UserForm) => Promise<void>;
}) {
  const activeSites = sites.filter((site) => site.is_active);
  const [form, setForm] = useState<UserForm>(user ? {
    ...EMPTY_FORM,
    first_name: user.first_name,
    last_name: user.last_name,
    matricule: user.matricule,
    role: user.role,
    site_id: user.site ? String(user.site.id) : '',
    is_active: user.is_active,
  } : { ...EMPTY_FORM, site_id: activeSites[0] ? String(activeSites[0].id) : '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof UserForm,>(key: K, value: UserForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(form);
    } catch (saveError) {
      setError(message(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{user ? 'PROFIL UTILISATEUR' : 'NOUVEL ACCÈS'}</span>
            <h2 id="form-title">{user ? 'Modifier le compte' : 'Créer un utilisateur'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Prénom<input required maxLength={100} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></label>
            <label>Nom<input required maxLength={100} value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></label>
            <label>Matricule<input required maxLength={100} autoCapitalize="characters" value={form.matricule} onChange={(e) => set('matricule', e.target.value)} /></label>
            <label>Rôle
              <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </label>
            <label className="span-two">Site
              <select required={!user} value={form.site_id} onChange={(e) => set('site_id', e.target.value)}>
                {user && <option value="">Aucun site</option>}
                {!user && <option value="" disabled>Sélectionner un site</option>}
                {sites.filter((site) => site.is_active || site.id === user?.site?.id).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}{site.code ? ` — ${site.code}` : ''}{site.is_active ? '' : ' (inactif)'}
                  </option>
                ))}
              </select>
            </label>
            <label>{user ? 'Nouveau PIN (facultatif)' : 'PIN'}
              <input required={!user} type="password" minLength={6} maxLength={50} autoComplete="new-password" value={form.pin} onChange={(e) => set('pin', e.target.value)} />
            </label>
            <label>Confirmer le PIN
              <input required={!user} type="password" minLength={6} maxLength={50} autoComplete="new-password" value={form.pin_confirmation} onChange={(e) => set('pin_confirmation', e.target.value)} />
            </label>
            <label className="status-field span-two">
              <span>Statut du compte</span>
              <span className="switch-row">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
                <span>{form.is_active ? 'Actif' : 'Inactif'}</span>
              </span>
            </label>
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : user ? 'Enregistrer' : "Créer l’utilisateur"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [matricule, setMatricule] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await login(matricule, pin));
    } catch (loginError) {
      setError(message(loginError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <img className="brand-lockup" src="/operix-logo.png" alt="OPERIX" />
        <span className="eyebrow">ESPACE ADMINISTRATEUR</span>
        <h1>Administration</h1>
        <p className="muted">Connectez-vous avec votre matricule OPERIX et votre PIN.</p>
        <form onSubmit={submit}>
          <label>Matricule<input required autoComplete="username" placeholder="Ex. MAT-0001" value={matricule} onChange={(e) => setMatricule(e.target.value)} /></label>
          <label>Code PIN<input required type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
        <p className="login-foot">Accès réservé aux comptes autorisés à gérer les utilisateurs.</p>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<AdminUser | null | undefined>(undefined);
  const [section, setSection] = useState<'users' | 'companies' | 'employees' | 'incidents' | 'near-miss' | 'breaches'>('users');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('operix-admin-theme') === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('operix-admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: String(page), per_page: '100' });
      if (search.trim()) query.set('search', search.trim());
      if (role) query.set('role', role);
      if (siteId) query.set('site_id', siteId);
      if (status) query.set('status', status);
      const tenantId = session.abilities.includes('platform.manage') ? selectedTenantId ?? session.tenant?.id : undefined;
      getUsers(query, controller.signal, tenantId)
        .then((result) => {
          setUsers(result.data);
          setTotal(result.meta.total);
          setSites(result.sites);
        })
        .catch((loadError: unknown) => {
          if (!controller.signal.aborted) setError(message(loadError));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [session, selectedTenantId, search, role, siteId, status, page, reload]);

  useEffect(() => {
    if (!session?.abilities.includes('platform.manage')) return;
    let active = true;
    getPlatformCompanies()
      .then((result) => {
        if (!active) return;
        setCompanies(result.data);
        if (selectedTenantId === null && session.tenant) setSelectedTenantId(session.tenant.id);
      })
      .catch((loadError: unknown) => { if (active) setError(message(loadError)); });
    return () => { active = false; };
  }, [session]);

  const save = async (form: UserForm) => {
    if (form.pin && form.pin !== form.pin_confirmation) throw new ApiError('La confirmation du PIN ne correspond pas.', 422);
    const tenantId = session?.abilities.includes('platform.manage') ? selectedTenantId ?? session.tenant?.id : undefined;
    if (editing) await updateUser(editing.id, form, tenantId);
    else await createUser(form, tenantId);
    setEditing(undefined);
    setNotice(editing ? 'Le compte a été mis à jour.' : 'L’utilisateur a été créé.');
    setReload((value) => value + 1);
  };

  const selectCompany = (company: Company) => {
    setCompanies((current) => [...current.filter((item) => item.id !== company.id), company].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedTenantId(company.id);
    setSection('users');
    setPage(1);
    setReload((value) => value + 1);
  };

  const signOut = async () => {
    try {
      await logout();
    } catch {
      // L'accès est supprimé de la mémoire, même si le réseau est indisponible.
    } finally {
      setAccessToken(null);
      setSession(null);
      setUsers([]);
    }
  };

  if (!session) return <div className="app-theme"><Login onLogin={(next) => { setSession(next); setSelectedTenantId(next.tenant?.id ?? null); }} /></div>;

  const isPlatformAdmin = session.abilities.includes('platform.manage');
  const tenantId = isPlatformAdmin ? selectedTenantId ?? session.tenant?.id : undefined;
  const selectedCompany = companies.find((company) => company.id === tenantId);
  const tenantName = selectedCompany?.name ?? session.tenant?.name ?? 'Société';

  return (
    <div className={`app-theme ${theme === 'dark' ? 'theme-dark' : ''}`}>
    <div className="admin-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OPERIX Administration">
          <img src="/operix-mark.png" alt="" />
          <span>OPERIX <small>ADMINISTRATION</small></span>
        </a>
        <div className="account">
          <div className="account-copy"><strong>{session.user.name}</strong><span>{isPlatformAdmin ? `Plateforme · ${tenantName}` : tenantName}</span></div>
          {isPlatformAdmin && <label className="company-switch"><span className="sr-only">Société gérée</span><select aria-label="Société gérée" value={tenantId ?? ''} onChange={(event) => { setSelectedTenantId(event.target.value ? Number(event.target.value) : null); setSection('users'); setPage(1); setReload((value) => value + 1); }}><option value="" disabled>Choisir une société</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.status === 'suspended' ? ' (suspendue)' : ''}</option>)}</select></label>}
          <button className="button secondary compact" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}>{theme === 'dark' ? '☀️ Clair' : '🌙 Sombre'}</button>
          <button className="button secondary compact" onClick={() => void signOut()}>Déconnexion</button>
        </div>
      </header>
      {section === 'companies' && isPlatformAdmin ? (
        <Companies selectedId={tenantId ?? null} onSelect={selectCompany} />
      ) : section === 'employees' ? (
        <Employees onBack={() => setSection('users')} tenantId={tenantId} />
      ) : section === 'incidents' ? (
        <Incidents onBack={() => setSection('users')} canClose={session.abilities.includes('incidents.close')} tenantId={tenantId} />
      ) : section === 'near-miss' || section === 'breaches' ? (
        <Records kind={section} onBack={() => setSection('users')} tenantId={tenantId} />
      ) : <main className="content">
        <div className="breadcrumbs">Administration <span>/</span> Utilisateurs</div>
        <div className="page-heading">
          <div>
            <span className="eyebrow">GESTION DES ACCÈS</span>
            <h1>Utilisateurs</h1>
            <p className="muted">Gérez les comptes de {tenantName}.</p>
          </div>
          <div className="page-actions">
            {session.abilities.includes('incidents.update') && <button className="button secondary" onClick={() => setSection('incidents')}>Suivi des incidents</button>}
            {session.abilities.includes('near_miss.view') && <button className="button secondary" onClick={() => setSection('near-miss')}>Presqu’accidents</button>}
            {session.abilities.includes('breaches.manage') && <button className="button secondary" onClick={() => setSection('breaches')}>Violations</button>}
            {session.abilities.includes('employees.manage') && <button className="button secondary" onClick={() => setSection('employees')}>Fiches employés</button>}
            {isPlatformAdmin && <button className="button secondary" onClick={() => setSection('companies')}>Gérer les sociétés</button>}
            <button className="button primary" onClick={() => setEditing(null)}>＋ Nouvel utilisateur</button>
          </div>
        </div>
        <section className="panel">
          <div className="filters">
            <label className="search-field"><span>Rechercher</span><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nom ou matricule…" /></label>
            <label><span>Rôle</span><select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">Tous les rôles</option>{ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></label>
            <label><span>Site</span><select value={siteId} onChange={(e) => { setSiteId(e.target.value); setPage(1); }}><option value="">Tous les sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <label><span>Statut</span><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tous</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></label>
          </div>
          {notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
          {error && <div className="alert error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Utilisateur</th><th>Matricule</th><th>Rôle</th><th>Site</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {loading && <tr><td className="table-state" colSpan={6}>Chargement des utilisateurs…</td></tr>}
                {!loading && !users.length && <tr><td className="table-state" colSpan={6}>Aucun utilisateur ne correspond à ces filtres.</td></tr>}
                {!loading && users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><small>{user.email ?? '—'}</small></td>
                    <td><span className="matricule">{user.matricule}</span></td>
                    <td>{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td>{user.site?.name ?? '—'}</td>
                    <td><span className={`status ${user.is_active ? 'active' : 'inactive'}`}><i />{user.is_active ? 'Actif' : 'Inactif'}</span></td>
                    <td><button className="button secondary compact" onClick={() => setEditing(user)}>Modifier</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer"><span>{total} utilisateur{total === 1 ? '' : 's'} dans votre société</span><div><button className="button secondary compact" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page}</span><button className="button secondary compact" disabled={page * 100 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></div>
        </section>
        <footer className="footer-note">Les PIN sont hachés côté serveur et ne sont jamais renvoyés à cette interface.</footer>
      </main>}
      {editing !== undefined && <UserDialog user={editing} sites={sites} onClose={() => setEditing(undefined)} onSave={save} />}
    </div>
    </div>
  );
}
