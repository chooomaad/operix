import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  createEmployee,
  getEmployees,
  importEmployees,
  updateEmployee,
} from './api';
import type { Employee, EmployeeForm } from './api';
import { employeeCsvTemplate, parseEmployeeCsv } from './employeeCsv';
import type { EmployeeCsvResult } from './employeeCsv';

const EMPTY_FORM: EmployeeForm = {
  matricule: '',
  nom: '',
  prenom: '',
  poste: '',
  type_contrat: '',
  gender: '',
  date_embauche: '',
  nationalite: '',
  department: '',
  is_active: true,
};

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}

function downloadCsvTemplate(): void {
  const blob = new Blob(['\uFEFF', employeeCsvTemplate()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modele-employes-operix.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function EmployeeImportDialog({
  result,
  fileName,
  busy,
  error,
  onClose,
  onImport,
}: {
  result: EmployeeCsvResult;
  fileName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onImport: () => void;
}) {
  const preview = result.rows.slice(0, 8);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="employee-import-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">IMPORT CSV</span>
            <h2 id="employee-import-title">Vérifier les employés</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Fermer">×</button>
        </div>
        <p className="muted">{fileName} · {result.rows.length} ligne{result.rows.length === 1 ? '' : 's'} détectée{result.rows.length === 1 ? '' : 's'}</p>
        {!!result.errors.length && (
          <div className="import-errors" role="alert">
            <strong>Corrigez ces erreurs dans le CSV avant l’import :</strong>
            <ul>{result.errors.slice(0, 10).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
            {result.errors.length > 10 && <p>… et {result.errors.length - 10} autre(s) erreur(s).</p>}
          </div>
        )}
        {error && <div className="alert error import-alert" role="alert">{error}</div>}
        <div className="table-wrap import-preview">
          <table>
            <thead><tr><th>Matricule</th><th>Prénom</th><th>Nom</th><th>Poste</th><th>Département</th></tr></thead>
            <tbody>{preview.map((row, index) => (
              <tr key={`${row.matricule}-${index}`}>
                <td>{row.matricule || '—'}</td><td>{row.prenom}</td><td>{row.nom}</td>
                <td>{row.poste || '—'}</td><td>{row.department || '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {result.rows.length > preview.length && <p className="muted import-more">Aperçu des {preview.length} premières lignes.</p>}
        <p className="import-note">L’import est atomique : si une ligne est invalide ou si un matricule existe déjà, aucune ligne ne sera ajoutée.</p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Annuler</button>
          <button className="button primary" onClick={onImport} disabled={busy || result.errors.length > 0 || result.rows.length === 0}>
            {busy ? 'Import en cours…' : `Importer ${result.rows.length} employé${result.rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmployeeDialog({
  employee,
  onClose,
  onSave,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSave: (form: EmployeeForm) => Promise<void>;
}) {
  const [form, setForm] = useState<EmployeeForm>(employee ? {
    matricule: employee.matricule ?? '',
    nom: employee.nom,
    prenom: employee.prenom,
    poste: employee.poste ?? '',
    type_contrat: employee.type_contrat ?? '',
    gender: employee.gender ?? '',
    date_embauche: employee.date_embauche ?? '',
    nationalite: employee.nationalite ?? '',
    department: employee.department?.name ?? '',
    is_active: employee.is_active,
  } : { ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof EmployeeForm,>(key: K, value: EmployeeForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

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
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">DOSSIER EMPLOYÉ</span>
            <h2 id="employee-form-title">{employee ? 'Modifier la fiche' : 'Nouvel employé'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Prénom<input required maxLength={100} value={form.prenom} onChange={(event) => set('prenom', event.target.value)} /></label>
            <label>Nom<input required maxLength={100} value={form.nom} onChange={(event) => set('nom', event.target.value)} /></label>
            <label>Matricule employé<input maxLength={100} value={form.matricule} onChange={(event) => set('matricule', event.target.value)} /></label>
            <label>Poste<input maxLength={150} value={form.poste} onChange={(event) => set('poste', event.target.value)} /></label>
            <label>Département<input maxLength={150} value={form.department} onChange={(event) => set('department', event.target.value)} placeholder="Ex. Exploitation" /></label>
            <label>Type de contrat<input maxLength={100} value={form.type_contrat} onChange={(event) => set('type_contrat', event.target.value)} placeholder="Ex. CDI" /></label>
            <label>Genre
              <select value={form.gender} onChange={(event) => set('gender', event.target.value)}>
                <option value="">Non renseigné</option>
                <option value="female">Femme</option>
                <option value="male">Homme</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <label>Date d'embauche<input type="date" value={form.date_embauche} onChange={(event) => set('date_embauche', event.target.value)} /></label>
            <label className="span-two">Nationalité<input maxLength={100} value={form.nationalite} onChange={(event) => set('nationalite', event.target.value)} /></label>
            <label className="status-field span-two">
              <span>Statut de l'employé</span>
              <span className="switch-row">
                <input type="checkbox" checked={form.is_active} onChange={(event) => set('is_active', event.target.checked)} />
                <span>{form.is_active ? 'Actif' : 'Inactif'}</span>
              </span>
            </label>
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : employee ? 'Enregistrer la fiche' : "Créer l'employé"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Employees({
  onBack,
  tenantId,
}: {
  onBack: () => void;
  tenantId?: number;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [csv, setCsv] = useState<{ fileName: string; result: EmployeeCsvResult } | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ page: String(page), per_page: '100' });
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      getEmployees(query, controller.signal, tenantId)
        .then((result) => {
          setEmployees(result.data);
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

  const save = async (form: EmployeeForm) => {
    if (editing) await updateEmployee(editing.id, form, tenantId);
    else await createEmployee(form, tenantId);
    setEditing(undefined);
    setNotice(editing ? 'La fiche employé a été mise à jour.' : "L'employé a été créé.");
    setReload((value) => value + 1);
  };

  const selectCsv = async (file: File | undefined) => {
    if (!file) return;
    setCsv(null);
    setCsvError('');
    if (file.size > 5 * 1024 * 1024) {
      setCsvError('Le fichier dépasse la taille maximale de 5 Mo.');
      return;
    }
    try {
      setCsv({ fileName: file.name, result: parseEmployeeCsv(await file.text()) });
    } catch (parseError) {
      setCsvError(parseError instanceof Error ? parseError.message : 'Impossible de lire ce fichier CSV.');
    }
  };

  const submitCsv = async () => {
    if (!csv || csv.result.errors.length || !csv.result.rows.length) return;
    setCsvBusy(true);
    setCsvError('');
    try {
      const { imported } = await importEmployees(csv.result.rows, tenantId);
      setCsv(null);
      setNotice(`${imported} employé${imported === 1 ? '' : 's'} importé${imported === 1 ? '' : 's'} avec succès.`);
      setPage(1);
      setReload((value) => value + 1);
    } catch (importError) {
      setCsvError(message(importError));
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <main className="content">
      <div className="breadcrumbs">Administration <span>/</span> <button className="text-button" onClick={onBack}>Utilisateurs</button> <span>/</span> Employés</div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DOSSIERS DU PERSONNEL</span>
          <h1>Employés</h1>
          <p className="muted">Créez et tenez à jour les fiches du personnel de l’entreprise sélectionnée.</p>
        </div>
        <div className="page-actions">
          <button className="button secondary" type="button" onClick={downloadCsvTemplate}>Télécharger le modèle CSV</button>
          <label className="button secondary file-button">
            Importer un CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                void selectCsv(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button className="button primary" onClick={() => setEditing(null)}>＋ Nouvel employé</button>
        </div>
      </div>
      <section className="panel">
        <div className="filters employee-filters">
          <label className="search-field"><span>Rechercher</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nom, matricule ou poste…" /></label>
          <label><span>Statut</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tous</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></label>
        </div>
        {notice && <div className="alert success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
        {error && <div className="alert error" role="alert">{error}<button onClick={() => setReload((value) => value + 1)}>Réessayer</button></div>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employé</th><th>Matricule</th><th>Poste</th><th>Département</th><th>Contrat</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {loading && <tr><td className="table-state" colSpan={7}>Chargement des fiches…</td></tr>}
              {!loading && !employees.length && <tr><td className="table-state" colSpan={7}>Aucune fiche ne correspond à ces filtres.</td></tr>}
              {!loading && employees.map((employee) => (
                <tr key={employee.id}>
                  <td><strong>{`${employee.prenom} ${employee.nom}`.trim()}</strong><small>{employee.nationalite ?? '—'}</small></td>
                  <td><span className="matricule">{employee.matricule ?? '—'}</span></td>
                  <td>{employee.poste ?? '—'}</td>
                  <td>{employee.department?.name ?? '—'}</td>
                  <td>{employee.type_contrat ?? '—'}</td>
                  <td><span className={`status ${employee.is_active ? 'active' : 'inactive'}`}><i />{employee.is_active ? 'Actif' : 'Inactif'}</span></td>
                  <td><button className="button secondary compact" onClick={() => setEditing(employee)}>Modifier</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>{total} employé{total === 1 ? '' : 's'} dans votre société</span><div><button className="button secondary compact" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page}</span><button className="button secondary compact" disabled={page * 100 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></div>
      </section>
      {editing !== undefined && <EmployeeDialog employee={editing} onClose={() => setEditing(undefined)} onSave={save} />}
      {csvError && !csv && <div className="alert error csv-page-error" role="alert">{csvError}<button onClick={() => setCsvError('')}>Fermer</button></div>}
      {csv && <EmployeeImportDialog
        result={csv.result}
        fileName={csv.fileName}
        busy={csvBusy}
        error={csvError}
        onClose={() => { setCsv(null); setCsvError(''); }}
        onImport={() => void submitCsv()}
      />}
    </main>
  );
}
