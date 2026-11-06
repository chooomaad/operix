import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { API_URL } from '@/constants/config';
import { colors } from '@/constants/theme';
import { ActionCard } from '@/components/ActionCard';
import { Screen } from '@/components/Screen';
import { Button, Card, ErrorState, KeyValue, LoadingState, ProgressBar, SectionHeader, SeverityBadge, StatusBadge, T, Timeline, TopBar } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { buildTimeline } from '@/features/incidents/timeline';
import { invalidate, useQuery } from '@/hooks/useQuery';
import { statusLabel } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { errorMessage, tokenStore } from '@/services/api';
import { actionsService } from '@/services/actions';
import { incidentsService } from '@/services/incidents';
import type { ActionStatus, RecordStatus } from '@/types/api';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/features/theme/ThemeProvider';

const NEXT_ACTION: Record<ActionStatus, ActionStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
const NEXT_STATUS: Record<RecordStatus, RecordStatus | null> = { open: 'in_progress', in_progress: null, closed: null };

export default function IncidentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const incidentId = Number(id);
  const { can } = useAuth();
  const theme = useTheme();
  const inc = useQuery(`incidents:${incidentId}`, () => incidentsService.get(incidentId));
  const acts = useQuery(`incidents:${incidentId}:actions`, () => actionsService.forIncident(incidentId));
  const [busy, setBusy] = useState(false);

  const canUpdate = can('incidents.update');

  const toggle = async (actionId: number, status: ActionStatus) => {
    try {
      await actionsService.setStatus(incidentId, actionId, NEXT_ACTION[status]);
      invalidate('actions');
      await Promise.all([acts.refresh(), inc.refresh()]);
    } catch (e) {
      showAlert('Mise à jour impossible', errorMessage(e));
    }
  };

  const advance = async () => {
    const i = inc.data;
    if (!i) return;
    const next = NEXT_STATUS[i.status];
    if (!next) {
      showAlert('Clôture', 'La clôture des incidents est réservée au portail web OPERIX.');
      return;
    }
    setBusy(true);
    try {
      await incidentsService.updateStatus(i.id, next);
      invalidate('incidents');
      await inc.refresh();
    } catch (e) {
      showAlert('Mise à jour impossible', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // Navigateur : pas de système de fichiers natif, on télécharge directement.
        const res = await fetch(`${API_URL}/reports/incidents/${incidentId}`, {
          headers: { Authorization: `Bearer ${tokenStore.current() ?? ''}`, Accept: 'application/pdf' },
        });
        if (!res.ok) throw new Error(String(res.status));
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = `incident-${inc.data?.reference ?? incidentId}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        return;
      }
      const target = `${FileSystem.cacheDirectory}${inc.data?.reference ?? 'incident'}.pdf`;
      const res = await FileSystem.downloadAsync(`${API_URL}/reports/incidents/${incidentId}`, target, {
        headers: { Authorization: `Bearer ${tokenStore.current() ?? ''}`, Accept: 'application/pdf' },
      });
      if (res.status !== 200) throw new Error(String(res.status));
      await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf' });
    } catch {
      showAlert('Téléchargement impossible', 'La fiche PDF n\'a pas pu être générée.');
    } finally {
      setBusy(false);
    }
  };

  const i = inc.data;
  const actions = acts.data ?? [];
  const done = actions.filter((a) => a.status === 'done').length;
  const pct = actions.length ? Math.round((done / actions.length) * 100) : 0;
  const a = i?.ai_analysis;

  return (
    <Screen header={<TopBar title="Incident" back />} refreshing={inc.refreshing} onRefresh={() => void Promise.all([inc.refresh(), acts.refresh()])}>
      {inc.loading ? (
        <LoadingState />
      ) : !i ? (
        <ErrorState message={errorMessage(inc.error, 'Incident introuvable.')} onRetry={inc.refresh} />
      ) : (
        <>
          <View className="mt-2 flex-row items-center justify-between">
            <StatusBadge label={statusLabel[i.status]} tone={i.status === 'closed' ? 'green' : i.status === 'in_progress' ? 'blue' : 'orange'} dot />
            <T variant="caption">{i.reference}</T>
          </View>
          <T variant="display" className="mt-3">
            {a?.category ?? i.type}
          </T>
          <View className="mt-2">
            <SeverityBadge severity={i.severity} prefix="Risque " />
          </View>

          <Card className="mt-4">
            <KeyValue label="Classification" value={`${i.type}${a?.subcategory ? ` • ${a.subcategory}` : ''}`} />
            <KeyValue label="Horodatage" value={`${i.date ?? ''} ${i.time ?? ''}`.trim() || '—'} />
            <KeyValue label="Emplacement" value={i.location} />
            <KeyValue label="Personnes impliquées" value="Voir fiche web" />
            <KeyValue label="Déclarant" value={i.reported_by?.name ?? '—'} />
          </Card>

          <SectionHeader title="Constat terrain" />
          <Card>
            <T variant="body">{i.description}</T>
          </Card>

          <SectionHeader title="Preuve terrain horodatée" />
          {i.image_url ? (
            <View className="overflow-hidden rounded-2xl border border-border">
              <Image source={{ uri: i.image_url }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" transition={150} />
              <View className="bg-surface px-4 py-2.5" style={{ backgroundColor: theme.colors.surface }}>
                <T variant="caption">Ajoutée : {formatDateTime(i.created_at)}</T>
              </View>
            </View>
          ) : (
            <Card>
              <T variant="caption">Aucune photo jointe.</T>
            </Card>
          )}

          {a ? (
            <>
              <SectionHeader title={a.engine === 'ai' ? 'Operix AI Engine' : 'Analyse (moteur de règles)'} right={<StatusBadge label={`${a.confidence}% confiance`} tone="blue" />} />
              <Card>
                <T variant="overline">Cause racine identifiée</T>
                <T variant="body" className="mt-1">
                  {i.root_cause ?? a.causes[0] ?? '—'}
                </T>
                {a.aggravating_factor ? (
                  <>
                    <T variant="overline" className="mt-4">
                      Facteur aggravant
                    </T>
                    <T variant="body" className="mt-1">
                      {a.aggravating_factor}
                    </T>
                  </>
                ) : null}
                {a.legal_reference ? (
                  <>
                    <T variant="overline" className="mt-4">
                      Référentiel légal
                    </T>
                    <T variant="body" className="mt-1">
                      {a.legal_reference}
                    </T>
                  </>
                ) : null}
              </Card>
            </>
          ) : null}

          <SectionHeader title="Plan d'actions correctives" right={actions.length ? <T variant="label">{`${done} / ${actions.length} (${pct}%)`}</T> : undefined} />
          {actions.length ? (
            <>
              <View className="mb-3">
                <ProgressBar value={pct} />
              </View>
              {actions.map((x, k) => (
                <ActionCard
                  key={x.id}
                  index={k + 1}
                  priority={x.priority}
                  delayMinutes={x.delay_minutes}
                  responsible={x.responsible_role}
                  description={x.description}
                  status={x.status}
                  overdue={x.is_overdue}
                  onToggle={canUpdate ? () => void toggle(x.id, x.status) : undefined}
                />
              ))}
              {canUpdate ? <T variant="caption">Touchez un statut pour le faire avancer.</T> : null}
            </>
          ) : (
            <Card>
              <T variant="caption">{i.corrective_action ?? 'Aucun plan d\'actions déployé.'}</T>
            </Card>
          )}

          <SectionHeader title="Chronologie & Audit Trail" />
          <Card>
            <Timeline items={buildTimeline(i, actions)} />
          </Card>

          <View className="mt-6" style={{ gap: 10 }}>
            {canUpdate && i.status !== 'closed' ? (
              <Button label={i.status === 'open' ? 'Passer en investigation' : 'Clôturer (web)'} icon="refresh-cw" onPress={advance} loading={busy} />
            ) : null}
            {can('reports.generate') ? <Button kind="secondary" icon="download" label="Télécharger la fiche d'audit (PDF)" onPress={downloadPdf} disabled={busy} /> : null}
          </View>
          <View className="mt-4 flex-row items-center justify-center">
            <Feather name="shield" size={12} color={colors.faint} />
            <T variant="caption" className="ml-1.5 text-faint">
              Historique horodaté par le serveur
            </T>
          </View>
        </>
      )}
    </Screen>
  );
}
