import { colors } from '@/constants/theme';
import type { ActionPriority, ActionStatus, RecordStatus, Severity } from '@/types/api';

export const severityLabel: Record<Severity, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
};

/** Rouge réservé à élevé/critique, orange à moyen ; faible reste neutre. */
export const severityTone: Record<Severity, { fg: string; bg: string }> = {
  low: { fg: colors.muted, bg: colors.divider },
  medium: { fg: colors.orange, bg: colors.orangeSoft },
  high: { fg: colors.red, bg: colors.redSoft },
  critical: { fg: '#FFFFFF', bg: colors.red },
};

export const statusLabel: Record<RecordStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En investigation',
  closed: 'Clôturé',
};

export const actionStatusLabel: Record<ActionStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Fait',
};

export const priorityLabel: Record<ActionPriority, string> = {
  immediate: 'Immédiat',
  urgent: 'Urgent',
  shift: 'Dans le quart',
  prevention: 'Prévention',
};

export const priorityTone: Record<ActionPriority, string> = {
  immediate: colors.red,
  urgent: colors.orange,
  shift: colors.blue,
  prevention: colors.green,
};

export const roleLabel: Record<string, string> = {
  company_admin: 'Administrateur',
  hsse_manager: 'Responsable HSSE',
  supervisor: 'Superviseur',
  agent: 'Agent terrain',
};
