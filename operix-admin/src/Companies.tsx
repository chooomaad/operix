import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, createPlatformCompany, getPlatformCompanies, suspendPlatformCompany, updatePlatformCompany } from './api';
import type { Company, CompanyForm } from './api';

const EMPTY_FORM: CompanyForm = { slug: '', name: '', short_name: '', country: '', timezone: 'UTC', status: 'active' };
const STATUS_LABELS: Record<Company['status'], string> = { active: 'Active', suspended: 'Suspendue', expired: 'Expirée' };

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}

function CompanyDialog({
  company,
  onClose,
  onSave,
}: {
  company: Company | null;
  onClose: () => void;
  onSave: (form: CompanyForm) => Promise<void>;
}) {
  const [form, setForm] = useState<CompanyForm>(company ? {
    slug: company.slug,
    name: company.name,
    short_name: company.short_name ?? '',
    country: company.country ?? '',
    timezone: company.timezone,
    status: company.status,
  } : { ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof CompanyForm,>(key: K, value: CompanyForm[K]) => setForm((current) => ({ ...current, [key]: value }));

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
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="company-form-title">
        <div className="modal-heading">
          <div><span className="eyebrow">ESPACE ENTREPRISE</span><h2 id="company-form-title">{company ? 'Modifier la société' : 'Créer une société'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Fermer">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Nom de l’entreprise<input required minLength={2} maxLength={150} value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
            <label>Nom court<input maxLength={80} value={form.short_name} onChange={(event) => set('short_name', event.target.value)} /></label>
            <label>Identifiant (slug)<input required minLength={2} maxLength={80} disabled={!!company} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => set('slug', event.target.value.toLowerCase())} placeholder="ex. operix-industrie" /></label>
            <label>Pays<input maxLength={100} value={form.country} onChange={(event) => set('country', event.target.value)} /></label>
            <label>Fuseau horaire<input required maxLength={80} value={form.timezone} onChange={(event) => set('timezone', event.target.value)} placeholder="Africa/Nouakchott" /></label>
            {company && <label>Statut<select value={form.status} onChange={(event) => set('status', event.target.value as Company['status'])}><option value="active">Active</option><option value="suspended">Suspendue</option><option value="expired">Expirée</option></select></label>}
          </div>
          {!company && <p className="muted">Un site « Principal » sera créé automatiquement. Créez ensuite l’administrateur de cette société depuis son espace utilisateurs.</p>}
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Annuler</button>
            <button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : company ? 'Enregistrer' : 'Créer la société'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Companies({
  selectedId,
  onSelect,
}: {
  selectedId: number | null;
  onSelect: (company: Company) => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<Company | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getPlatformCompanies()
      .then((result) => { if (active) setCompanies(result.data); })
      .catch((loadError: unknown) => { if (active) setError(message(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const save = async (form: CompanyForm) => {
    const company = editing
      ? await updatePlatformCompany(editing.id, form)
      : await createPlatformCompany(form);
    setEditing(undefined);
    setNotice(editing ? 'La société a été mise à jour.' : 'La société et son site principal ont été créés.');
    if (!editing) onSelect(company);
    setReload((value) => value + 1);
  };

  const suspend = async (company: Company) => {
    if (!window.confirm(`Suspendre ${company.name} ? Les données seront conservées et ses utilisateurs ne pourront plus se connecter.`)) return;
    setBusyId(company.id);
    setError('');
    try {
      await suspendPlatformCompany(company.id);
      setNotice(`${company.name} a été suspendue. Ses données sont conservées.`);
      setReload((value) => value + 1);
    } catch (updateError) {
      setError(message(updateError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="content">
      <div className="breadcrumbs">Administration <span>/</span> Sociétés</div>
      <div className="page-heading">
        <div><span className="eyebrow">ADMINISTRATION PLATEFORME</span><h1>Sociétés</h1><p className="muted">Créez des entreprises et ouvrez leur espace d’administration.</p></div>
        <button className="button primary" onClick={() => setEditing(null)}>＋ Nouvelle société</button>
      </div>
      <section className="panel">
        {notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
        {error && <div className="alert error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Société</th><th>Identifiant</th><th>Pays</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {loading && <tr><td className="table-state" colSpan={5}>Chargement des sociétés…</td></tr>}
              {!loading && !companies.length && <tr><td className="table-state" colSpan={5}>Aucune société. Créez la première pour commencer.</td></tr>}
              {!loading && companies.map((company) => (
                <tr key={company.id} className={selectedId === company.id ? 'selected-company' : undefined}>
                  <td><strong>{company.name}</strong><small>{company.short_name ?? '—'}</small></td>
                  <td><span className="matricule">{company.slug}</span></td>
                  <td>{company.country ?? '—'}</td>
                  <td><span className={`status ${company.status === 'active' ? 'active' : 'inactive'}`}><i />{STATUS_LABELS[company.status]}</span></td>
                  <td className="company-actions">
                    <button className="button primary compact" onClick={() => onSelect(company)}>{selectedId === company.id ? 'Société sélectionnée' : 'Gérer'}</button>
                    <button className="button secondary compact" onClick={() => setEditing(company)}>Modifier</button>
                    {company.status !== 'suspended' && <button className="button secondary compact" disabled={busyId === company.id} onClick={() => void suspend(company)}>{busyId === company.id ? 'Suspension…' : 'Suspendre'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>{companies.length} société{companies.length === 1 ? '' : 's'} enregistrée{companies.length === 1 ? '' : 's'}</span><span>La suppression est remplacée par une suspension pour préserver l’historique.</span></div>
      </section>
      {editing !== undefined && <CompanyDialog company={editing} onClose={() => setEditing(undefined)} onSave={save} />}
    </main>
  );
}
