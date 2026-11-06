import type { EmployeeForm } from './api';

export interface EmployeeCsvResult {
  rows: EmployeeForm[];
  errors: string[];
}

function parseRecords(source: string): string[][] {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index++;
      row.push(field);
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('Le CSV contient un guillemet non fermé.');
  row.push(field);
  if (row.some((cell) => cell.trim())) records.push(row);
  return records;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

const HEADER_ALIASES: Record<string, keyof EmployeeForm> = {
  nom: 'nom',
  lastname: 'nom',
  last_name: 'nom',
  prenom: 'prenom',
  firstname: 'prenom',
  first_name: 'prenom',
  matricule: 'matricule',
  employee_id: 'matricule',
  poste: 'poste',
  position: 'poste',
  job_title: 'poste',
  department: 'department',
  departement: 'department',
  type_contrat: 'type_contrat',
  contract_type: 'type_contrat',
  contrat: 'type_contrat',
  gender: 'gender',
  sexe: 'gender',
  date_embauche: 'date_embauche',
  hire_date: 'date_embauche',
  nationalite: 'nationalite',
  nationality: 'nationalite',
  is_active: 'is_active',
  actif: 'is_active',
  statut: 'is_active',
};

function parseDate(value: string): string {
  const input = value.trim();
  const frenchDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (frenchDate) return `${frenchDate[3]}-${frenchDate[2].padStart(2, '0')}-${frenchDate[1].padStart(2, '0')}`;
  return input;
}

function parseActive(value: string, line: number, errors: string[]): boolean {
  const normalized = normalizeHeader(value);
  if (!normalized || ['oui', 'yes', 'true', '1', 'actif', 'active'].includes(normalized)) return true;
  if (['non', 'no', 'false', '0', 'inactif', 'inactive'].includes(normalized)) return false;
  errors.push(`Ligne ${line} : statut invalide (« ${value} »). Utilisez actif/inactif ou oui/non.`);
  return true;
}

export function parseEmployeeCsv(source: string): EmployeeCsvResult {
  const records = parseRecords(source);
  if (records.length < 2) throw new Error('Le CSV doit contenir une ligne d’en-têtes et au moins un employé.');

  const headers = records[0].map((header) => HEADER_ALIASES[normalizeHeader(header)]);
  const firstNameColumn = headers.indexOf('prenom');
  const lastNameColumn = headers.indexOf('nom');
  const activeColumn = headers.indexOf('is_active');
  const mappedHeaders = headers.filter((header): header is keyof EmployeeForm => Boolean(header));
  if (new Set(mappedHeaders).size !== mappedHeaders.length) {
    throw new Error('Le fichier contient des colonnes en double. Gardez une seule colonne par champ.');
  }
  if (firstNameColumn < 0 || lastNameColumn < 0) {
    throw new Error('Les colonnes « prenom » et « nom » sont obligatoires. Téléchargez le modèle CSV pour les en-têtes attendus.');
  }
  if (records.length - 1 > 500) throw new Error('Import limité à 500 employés par fichier CSV.');

  const errors: string[] = [];
  const rows: EmployeeForm[] = [];
  const matricules = new Map<string, number>();

  for (const [index, record] of records.slice(1).entries()) {
    const line = index + 2;
    if (record.length !== headers.length) {
      errors.push(`Ligne ${line} : ${record.length} colonnes trouvées, ${headers.length} attendues.`);
      continue;
    }
    const values: Partial<Record<Exclude<keyof EmployeeForm, 'is_active'>, string>> = {};
    for (const [column, key] of headers.entries()) {
      if (key && key !== 'is_active') values[key] = record[column].trim();
    }
    if (!values.nom?.trim() || !values.prenom?.trim()) {
      errors.push(`Ligne ${line} : le nom et le prénom sont obligatoires.`);
      continue;
    }

    const matricule = values.matricule?.trim().toUpperCase() ?? '';
    if (matricule) {
      const previousLine = matricules.get(matricule);
      if (previousLine !== undefined) errors.push(`Ligne ${line} : matricule ${matricule} en double (déjà présent ligne ${previousLine}).`);
      else matricules.set(matricule, line);
    }
    const gender = normalizeHeader(values.gender ?? '');
    const normalizedGender = ({ f: 'female', femme: 'female', female: 'female', m: 'male', homme: 'male', male: 'male', autre: 'other', other: 'other' } as Record<string, string>)[gender] ?? (values.gender ?? '');
    const isActive = parseActive(activeColumn < 0 ? '' : record[activeColumn], line, errors);
    if (values.date_embauche) {
      const date = parseDate(values.date_embauche);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        errors.push(`Ligne ${line} : date_embauche invalide (« ${values.date_embauche} »). Utilisez AAAA-MM-JJ ou JJ/MM/AAAA.`);
      }
    }
    rows.push({
      matricule,
      nom: values.nom.trim(),
      prenom: values.prenom.trim(),
      poste: values.poste ?? '',
      type_contrat: values.type_contrat ?? '',
      gender: normalizedGender,
      date_embauche: parseDate(values.date_embauche ?? ''),
      nationalite: values.nationalite ?? '',
      department: values.department ?? '',
      is_active: isActive,
    });
  }

  if (!rows.length && !errors.length) throw new Error('Aucun employé valide à importer.');
  return { rows, errors };
}

export function employeeCsvTemplate(): string {
  return [
    'matricule,prenom,nom,poste,department,type_contrat,gender,date_embauche,nationalite,is_active',
    'EMP-001,Aïcha,Diallo,Cariste,Exploitation,CDI,female,2024-01-15,Mauritanienne,actif',
    'EMP-002,Moussa,Ba,Technicien,Maintenance,CDD,male,15/02/2023,Mauritanienne,actif',
  ].join('\r\n');
}
