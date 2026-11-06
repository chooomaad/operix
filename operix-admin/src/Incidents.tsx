import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, deleteIncident, getIncidents, saveIncident, updateIncidentStatus } from './api';
import type { Incident, IncidentForm, RecordStatus } from './api';

const STATUSES: { value: '' | RecordStatus; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'open', label: 'Ouverts' },
  { value: 'in_progress', label: 'En investigation' },
  { value: 'closed', label: 'Clôturés' },
];

const STATUS_LABELS: Record<RecordStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En investigation',
  closed: 'Clôturé',
};

const SEVERITY_LABELS: Record<Incident['severity'], string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  critical: 'Critique',
};

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
}

function IncidentDialog({ incident, onClose, onSave }: {
  incident: Incident | null;
  onClose: () => void;
  onSave: (form: IncidentForm) => Promise<void>;
}) {
  const [form, setForm] = useState<IncidentForm>({
    date: incident?.date ?? new Date().toISOString().slice(0, 10),
    location: incident?.location ?? '',
    type: incident?.type ?? 'Autre',
    severity: incident?.severity ?? 'medium',
    description: incident?.description ?? '',
    immediate_cause: incident?.immediate_cause ?? '',
    root_cause: incident?.root_cause ?? '',
    corrective_action: incident?.corrective_action ?? '',
    corrective_action_due: incident?.corrective_action_due ?? '',
    status: incident?.status ?? 'open',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof IncidentForm,>(key: K, value: IncidentForm[K]) => setForm((current) => ({ ...current, [key]: value }));
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
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="incident-form-title">
        <div className="modal-heading"><div><span className="eyebrow">DOSSIER HSSE</span><h2 id="incident-form-title">{incident ? `Modifier ${incident.reference}` : 'Créer un incident'}</h2></div><button className="icon-button" type="button" disabled={busy} onClick={onClose} aria-label="Fermer">×</button></div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Date<input type="date" required value={form.date} onChange={(event) => set('date', event.target.value)} /></label>
            <label>Type<select value={form.type} onChange={(event) => set('type', event.target.value)}>{['LTI', 'MTC', 'RWC', 'FAC', 'HPI', 'Fire', 'Security', 'Autre'].map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Lieu<input required maxLength={255} value={form.location} onChange={(event) => set('location', event.target.value)} /></label>
            <label>Gravité<select value={form.severity} onChange={(event) => set('severity', event.target.value as Incident['severity'])}>{(['low', 'medium', 'high', 'critical'] as const).map((value) => <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>)}</select></label>
            <label className="span-two">Description<textarea required maxLength={10000} rows={4} value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
            <label>Cause immédiate<input maxLength={5000} value={form.immediate_cause} onChange={(event) => set('immediate_cause', event.target.value)} /></label>
            <label>Cause racine<input maxLength={5000} value={form.root_cause} onChange={(event) => set('root_cause', event.target.value)} /></label>
            <label>Action corrective<input maxLength={5000} value={form.corrective_action} onChange={(event) => set('corrective_action', event.target.value)} /></label>
            <label>Échéance corrective<input type="date" value={form.corrective_action_due} onChange={(event) => set('corrective_action_due', event.target.value)} /></label>
            <label>Statut<select value={form.status} onChange={(event) => set('status', event.target.value as RecordStatus)}>{STATUSES.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Annuler</button><button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : incident ? 'Enregistrer' : 'Créer l’incident'}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function Incidents({ onBack, canClose, tenantId }: { onBack: () => void; canClose: boolean; tenantId?: number }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | RecordStatus>('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Incident | null | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: String(page), per_page: '50' });
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      getIncidents(query, controller.signal, tenantId)
        .then((result) => {
          setIncidents(result.data);
          setTotal(result.meta.total);
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
  }, [search, status, page, reload, tenantId]);

  const changeStatus = async (incident: Incident, nextStatus: RecordStatus) => {
    const action = nextStatus === 'closed' ? 'clôturer' : 'passer en investigation';
    if (!window.confirm(`Confirmer : ${action} l’incident ${incident.reference} ?`)) return;
    setBusyId(incident.id);
    setError('');
    setNotice('');
    try {
      await updateIncidentStatus(incident.id, nextStatus, tenantId);
      setNotice(`Incident ${incident.reference} : ${STATUS_LABELS[nextStatus].toLowerCase()}. Le nouvel état sera visible dans l’application mobile après actualisation.`);
      setReload((value) => value + 1);
    } catch (updateError) {
      setError(message(updateError));
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (incident: Incident) => {
    if (!window.confirm(`Archiver ${incident.reference} ? L’historique est conservé.`)) return;
    setBusyId(incident.id);
    setError('');
    setNotice('');
    try {
      await deleteIncident(incident.id, tenantId);
      setNotice(`Incident ${incident.reference} archivé.`);
      setReload((value) => value + 1);
    } catch (deleteError) {
      setError(message(deleteError));
    } finally {
      setBusyId(null);
    }
  };

  const save = async (form: IncidentForm) => {
    await saveIncident(form, editing?.id, tenantId);
    setEditing(undefined);
    setNotice(editing ? 'L’incident a été mis à jour.' : 'L’incident a été créé.');
    setReload((value) => value + 1);
  };

  return (
    <main className="content">
      <div className="breadcrumbs">Administration <span>/</span> <button className="text-button" onClick={onBack}>Utilisateurs</button> <span>/</span> Incidents</div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SUIVI HSSE</span>
          <h1>Incidents</h1>
          <p className="muted">Suivez, clôturez ou archivez les incidents de l’entreprise sélectionnée.</p>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>＋ Nouvel incident</button>
      </div>
      <section className="panel">
        <div className="filters employee-filters">
          <label className="search-field"><span>Rechercher</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Référence, description ou lieu…" /></label>
          <label><span>Statut</span><select value={status} onChange={(event) => { setStatus(event.target.value as '' | RecordStatus); setPage(1); }}>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        {notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
        {error && <div className="alert error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
        <div className="table-wrap">
          <table className="incident-table">
            <thead><tr><th>Référence / Date</th><th>Incident</th><th>Lieu</th><th>Gravité</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {loading && <tr><td className="table-state" colSpan={6}>Chargement des incidents…</td></tr>}
              {!loading && !incidents.length && <tr><td className="table-state" colSpan={6}>Aucun incident ne correspond à ces filtres.</td></tr>}
              {!loading && incidents.map((incident) => (
                <tr key={incident.id}>
                  <td><strong>{incident.reference}</strong><small>{dateLabel(incident.date)}</small></td>
                  <td className="incident-description"><strong>{incident.ai_analysis?.category ?? incident.type}</strong><small>{incident.description}</small></td>
                  <td>{incident.location}</td>
                  <td><span className={`severity severity-${incident.severity}`}>{SEVERITY_LABELS[incident.severity]}</span></td>
                  <td><span className={`status-pill status-${incident.status}`}>{STATUS_LABELS[incident.status]}</span></td>
                  <td>
                    <button className="button secondary compact" onClick={() => setEditing(incident)}>Modifier</button>
                    {incident.status === 'open' && <button className="button secondary compact" disabled={busyId === incident.id} onClick={() => void changeStatus(incident, 'in_progress')}>En investigation</button>}
                    {incident.status === 'in_progress' && canClose && <button className="button primary compact" disabled={busyId === incident.id} onClick={() => void changeStatus(incident, 'closed')}>{busyId === incident.id ? 'Clôture…' : 'Clôturer'}</button>}
                    {incident.status === 'in_progress' && !canClose && <span className="muted">Clôture réservée HSSE</span>}
                    {incident.status === 'closed' && <span className="muted">Terminé</span>}
                    <button className="button secondary compact" disabled={busyId === incident.id} onClick={() => void archive(incident)}>Archiver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>{total} incident{total === 1 ? '' : 's'} dans votre société</span><div><button className="button secondary compact" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page}</span><button className="button secondary compact" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></div>
      </section>
      {editing !== undefined && <IncidentDialog incident={editing} onClose={() => setEditing(undefined)} onSave={save} />}
    </main>
  );
}
