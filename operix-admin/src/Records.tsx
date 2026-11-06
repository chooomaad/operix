import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  deleteBreach,
  deleteNearMiss,
  getBreaches,
  getEmployees,
  getNearMisses,
  saveBreach,
  saveNearMiss,
} from './api';
import type { AdminBreach, AdminNearMiss, Employee, RecordForm, RecordStatus } from './api';

type RecordKind = 'near-miss' | 'breaches';
type ManagedRecord = AdminNearMiss | AdminBreach;

const STATUSES: { value: '' | RecordStatus; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'open', label: 'Ouverts' },
  { value: 'in_progress', label: 'En investigation' },
  { value: 'closed', label: 'Clôturés' },
];
const STATUS_LABELS: Record<RecordStatus, string> = { open: 'Ouvert', in_progress: 'En investigation', closed: 'Clôturé' };
const SEVERITY_LABELS = { low: 'Faible', medium: 'Moyenne', high: 'Élevée', critical: 'Critique' } as const;

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}

function dateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
}

function isBreach(record: ManagedRecord): record is AdminBreach {
  return 'employee_name' in record;
}

function RecordDialog({ kind, record, employees, onClose, onSave }: {
  kind: RecordKind;
  record: ManagedRecord | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (form: RecordForm) => Promise<void>;
}) {
  const breach = record && isBreach(record) ? record : null;
  const nearMiss = record && !isBreach(record) ? record : null;
  const [form, setForm] = useState<RecordForm>({
    date: record?.date ?? new Date().toISOString().slice(0, 10),
    location: record?.location ?? '',
    type: breach?.type ?? '',
    severity: record?.severity ?? 'medium',
    description: record?.description ?? '',
    status: record?.status ?? 'open',
    potential_consequence: nearMiss?.potential_consequence ?? '',
    corrective_action: nearMiss?.corrective_action ?? '',
    sanction: breach?.sanction ?? '',
    employee_id: breach?.employee_id ?? undefined,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof RecordForm,>(key: K, value: RecordForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await onSave(form); }
    catch (saveError) { setError(message(saveError)); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
        <div className="modal-heading">
          <div><span className="eyebrow">{kind === 'near-miss' ? 'PRESQU’ACCIDENT' : 'VIOLATION HSSE'}</span><h2 id="record-form-title">{record ? 'Modifier le dossier' : kind === 'near-miss' ? 'Nouveau presqu’accident' : 'Nouvelle violation'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Fermer">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Date<input type="date" required value={form.date} onChange={(event) => set('date', event.target.value)} /></label>
            <label>Gravité<select value={form.severity} onChange={(event) => set('severity', event.target.value as RecordForm['severity'])}>{(kind === 'near-miss' ? ['low', 'medium', 'high'] : ['low', 'medium', 'high', 'critical']).map((value) => <option key={value} value={value}>{SEVERITY_LABELS[value as keyof typeof SEVERITY_LABELS]}</option>)}</select></label>
            <label className="span-two">Lieu<input maxLength={255} value={form.location} onChange={(event) => set('location', event.target.value)} /></label>
            {kind === 'breaches' && <>
              <label>Type de violation<input required maxLength={100} value={form.type ?? ''} onChange={(event) => set('type', event.target.value)} /></label>
              <label>Employé concerné<select value={form.employee_id ?? ''} onChange={(event) => set('employee_id', event.target.value ? Number(event.target.value) : undefined)}><option value="">Non renseigné</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.prenom} {employee.nom}{employee.matricule ? ` — ${employee.matricule}` : ''}</option>)}</select></label>
            </>}
            <label className="span-two">Description<textarea required maxLength={10000} rows={4} value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
            {kind === 'near-miss'
              ? <>
                <label className="span-two">Conséquence potentielle<textarea maxLength={5000} rows={2} value={form.potential_consequence ?? ''} onChange={(event) => set('potential_consequence', event.target.value)} /></label>
                <label className="span-two">Action corrective<textarea maxLength={5000} rows={2} value={form.corrective_action ?? ''} onChange={(event) => set('corrective_action', event.target.value)} /></label>
              </>
              : <label className="span-two">Mesure / sanction<textarea maxLength={5000} rows={2} value={form.sanction ?? ''} onChange={(event) => set('sanction', event.target.value)} /></label>}
            <label>Statut<select value={form.status} onChange={(event) => set('status', event.target.value as RecordStatus)}>{STATUSES.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Annuler</button><button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : record ? 'Enregistrer' : 'Créer le dossier'}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function Records({ kind, onBack, tenantId }: { kind: RecordKind; onBack: () => void; tenantId?: number }) {
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | RecordStatus>('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ManagedRecord | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const title = kind === 'near-miss' ? 'Presqu’accidents' : 'Violations';

  useEffect(() => {
    if (kind !== 'breaches') return;
    const query = new URLSearchParams({ page: '1', per_page: '100', status: 'active' });
    getEmployees(query, undefined, tenantId).then((result) => setEmployees(result.data)).catch((loadError: unknown) => setError(message(loadError)));
  }, [kind, tenantId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: String(page), per_page: '50' });
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      const load = kind === 'near-miss' ? getNearMisses(query, controller.signal, tenantId) : getBreaches(query, controller.signal, tenantId);
      load.then((result) => { setRecords(result.data); setTotal(result.meta.total); })
        .catch((loadError: unknown) => { if (!controller.signal.aborted) setError(message(loadError)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [kind, tenantId, search, status, page, reload]);

  const save = async (form: RecordForm) => {
    if (kind === 'near-miss') await saveNearMiss(form, editing?.id, tenantId);
    else await saveBreach(form, editing?.id, tenantId);
    setEditing(undefined);
    setNotice(editing ? 'Le dossier a été mis à jour.' : 'Le dossier a été créé.');
    setReload((value) => value + 1);
  };

  const archive = async (record: ManagedRecord) => {
    if (!window.confirm(`Archiver ${record.reference} ? L’historique sera conservé.`)) return;
    setBusyId(record.id);
    setError('');
    try {
      if (kind === 'near-miss') await deleteNearMiss(record.id, tenantId);
      else await deleteBreach(record.id, tenantId);
      setNotice(`${record.reference} a été archivé.`);
      setReload((value) => value + 1);
    } catch (deleteError) {
      setError(message(deleteError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="content">
      <div className="breadcrumbs">Administration <span>/</span> <button className="text-button" onClick={onBack}>Utilisateurs</button> <span>/</span> {title}</div>
      <div className="page-heading"><div><span className="eyebrow">SUIVI HSSE</span><h1>{title}</h1><p className="muted">Consultez, créez, modifiez et archivez les dossiers de l’entreprise sélectionnée.</p></div><button className="button primary" onClick={() => setEditing(null)}>＋ Nouveau dossier</button></div>
      <section className="panel">
        <div className="filters employee-filters">
          <label className="search-field"><span>Rechercher</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Référence, description ou lieu…" /></label>
          <label><span>Statut</span><select value={status} onChange={(event) => { setStatus(event.target.value as '' | RecordStatus); setPage(1); }}>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        {notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
        {error && <div className="alert error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
        <div className="table-wrap">
          <table className="incident-table">
            <thead><tr><th>Référence / Date</th><th>Dossier</th><th>Lieu</th><th>Gravité</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {loading && <tr><td className="table-state" colSpan={6}>Chargement des dossiers…</td></tr>}
              {!loading && !records.length && <tr><td className="table-state" colSpan={6}>Aucun dossier ne correspond à ces filtres.</td></tr>}
              {!loading && records.map((record) => (
                <tr key={record.id}>
                  <td><strong>{record.reference}</strong><small>{dateLabel(record.date)}</small></td>
                  <td className="incident-description"><strong>{isBreach(record) ? record.type : 'Presqu’accident'}{isBreach(record) && record.employee_name ? ` — ${record.employee_name}` : ''}</strong><small>{record.description}</small></td>
                  <td>{record.location ?? '—'}</td>
                  <td><span className={`severity severity-${record.severity}`}>{SEVERITY_LABELS[record.severity]}</span></td>
                  <td><span className={`status-pill status-${record.status}`}>{STATUS_LABELS[record.status]}</span></td>
                  <td className="company-actions"><button className="button secondary compact" onClick={() => setEditing(record)}>Modifier</button><button className="button secondary compact" disabled={busyId === record.id} onClick={() => void archive(record)}>{busyId === record.id ? 'Archivage…' : 'Archiver'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>{total} dossier{total === 1 ? '' : 's'} dans l’entreprise sélectionnée</span><div><button className="button secondary compact" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page}</span><button className="button secondary compact" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></div>
      </section>
      {editing !== undefined && <RecordDialog kind={kind} record={editing} employees={employees} onClose={() => setEditing(undefined)} onSave={save} />}
    </main>
  );
}
