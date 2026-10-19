import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { AIInsightCard } from '@/components/AIInsightCard';
import { IncidentCard } from '@/components/IncidentCard';
import { Screen } from '@/components/Screen';
import { Card, EmptyState, ErrorState, LoadingState, ProgressBar, SectionHeader, StatCard, StatusBadge, T, TopBar } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useUnreadCount } from '@/hooks/useUnread';
import { errorMessage } from '@/services/api';
import { actionsService } from '@/services/actions';
import { dashboardService } from '@/services/dashboard';
import { firstName, formatDateTime } from '@/lib/format';
import type { Activity } from '@/types/api';

const ACTIVITY_LABEL: Record<Activity['type'], string> = {
  incident: 'Incident signalé',
  near_miss: 'Near-miss enregistré',
  breach: 'Infraction',
  property_damage: 'Dommage matériel',
  visitor: 'Visiteur',
};

export default function HomeScreen() {
  const { session, can } = useAuth();
  const unread = useUnreadCount();
  const summary = useQuery('dashboard:summary', dashboardService.summary);
  const activity = useQuery('dashboard:activity', dashboardService.recentActivity);
  const tracker = useQuery(can('safety_tracker.view') ? 'dashboard:tracker' : null, dashboardService.safetyTracker);
  const actions = useQuery('actions:open', () => actionsService.all());

  const s = summary.data?.safety;
  const openActions = actions.data?.filter((a) => a.status !== 'done').length ?? 0;
  const ytd = s?.incidents_ytd ?? 0;
  // « Conformité » = part des incidents de l'année déjà traités (non ouverts). Calcul affiché, pas inventé.
  const treated = ytd > 0 ? Math.round(((ytd - (s?.incidents_ouverts ?? 0)) / ytd) * 100) : 100;
  const good = treated >= 80 && (s?.lti_ytd ?? 0) === 0;

  const refresh = () => {
    void summary.refresh();
    void activity.refresh();
    void tracker.refresh();
    void actions.refresh();
  };

  return (
    <Screen header={<TopBar title="Accueil" status="SITE OPÉRATIONNEL" unread={unread} />} tabBarSpace refreshing={summary.refreshing} onRefresh={refresh}>
      <View className="mt-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <T variant="display">Bonjour, {firstName(session?.user.name)} 👋</T>
          <View className="mt-1 flex-row items-center">
            <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green" />
            <T variant="caption" numberOfLines={1}>
              Site opérationnel • {session?.tenant?.name ?? '—'}
            </T>
          </View>
        </View>
        {session?.user.matricule ? <StatusBadge label={session.user.matricule} tone="neutral" /> : null}
      </View>

      {summary.loading ? (
        <LoadingState />
      ) : summary.error && !s ? (
        <ErrorState message={errorMessage(summary.error)} onRetry={summary.refresh} />
      ) : (
        <>
          <Card className="mt-5 p-5">
            <View className="flex-row items-center justify-between">
              <T variant="overline">Statut sécurité</T>
              <StatusBadge label={`${treated}% traités`} tone={good ? 'green' : treated >= 50 ? 'orange' : 'red'} dot />
            </View>
            <T variant="title" className="mt-3">
              {good ? 'Bonne situation' : treated >= 50 ? 'Vigilance requise' : 'Situation dégradée'}
            </T>
            <T variant="body" className="mt-1 text-muted">
              {tracker.data
                ? `Aucun arrêt de travail depuis ${tracker.data.days_without_accident} jours`
                : `${s?.lti_ytd ?? 0} arrêt(s) de travail depuis le 1er janvier`}
            </T>
            <View className="mt-4">
              <ProgressBar value={treated} color={good ? colors.green : colors.orange} />
            </View>
            <View className="mt-3 flex-row items-center justify-between">
              <T variant="caption">Données au {formatDateTime(summary.data?.generated_at)}</T>
              <T variant="caption" className="font-semibold text-green-dark">
                Synchronisé
              </T>
            </View>
          </Card>

          <View className="mt-3 flex-row" style={{ gap: 10 }}>
            <StatCard label="Incidents" value={s?.incidents_mois ?? 0} onPress={() => router.push('/incidents')} />
            <StatCard label="Near-Miss" value={s?.near_miss_mois ?? 0} onPress={() => router.push('/near-miss')} />
            <StatCard label="Actions" value={openActions} tone={openActions > 0 ? 'text-orange' : 'text-navy'} onPress={() => router.push('/actions')} />
          </View>
          <T variant="caption" className="mt-1.5 text-faint">
            Ce mois-ci • actions ouvertes
          </T>
        </>
      )}

      <Pressable onPress={() => router.push('/declare')} className="mt-5 rounded-2xl bg-navy p-5">
        <View className="flex-row items-center">
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-green">
            <Feather name="plus" size={22} color="#fff" />
          </View>
          <View className="flex-1">
            <T variant="heading" className="text-white">
              Déclarer un incident
            </T>
            <T variant="caption" className="text-[#AEB7C7]">
              Formulaire rapide &lt; 60s avec assistance IA
            </T>
          </View>
          <Feather name="arrow-right" size={20} color="#fff" />
        </View>
        <View className="mt-4 flex-row" style={{ gap: 8 }}>
          {[
            { icon: 'camera' as const, label: 'Scan photo' },
            { icon: 'mic' as const, label: 'Dictée vocale' },
          ].map((c) => (
            <View key={c.label} className="flex-row items-center rounded-full bg-navy-soft px-3 py-1.5">
              <Feather name={c.icon} size={13} color="#C9D1DE" />
              <T className="ml-1.5 font-medium text-[12px] text-[#C9D1DE]">{c.label}</T>
            </View>
          ))}
        </View>
      </Pressable>

      <View className="mt-5">
        <AIInsightCard
          eyebrow="Operix AI • Alerte Prévention"
          title={s && s.near_miss_mois > 0 ? `${s.near_miss_mois} presqu'accident(s) ce mois-ci` : 'Aucun signal faible ce mois-ci'}
          text={
            s && s.incidents_ouverts > 0
              ? `${s.incidents_ouverts} incident(s) encore ouvert(s) sur le site. Chaque near-miss signalé est un accident évité.`
              : 'Continuez à signaler les situations dangereuses : elles alimentent la prévention.'
          }
          link="Voir les insights"
          onLink={() => router.push('/insights')}
        />
      </View>

      <SectionHeader title="Activité récente" action="Tout voir" onAction={() => router.push('/incidents')} />
      {activity.loading ? (
        <LoadingState />
      ) : !activity.data?.length ? (
        <EmptyState icon="check-circle" title="Aucune activité" text="Les déclarations du site apparaîtront ici." />
      ) : (
        activity.data
          .filter((a) => a.type !== 'visitor')
          .slice(0, 5)
          .map((a) => (
            <IncidentCard
              key={`${a.type}-${a.id}`}
              overline={ACTIVITY_LABEL[a.type]}
              title={a.title}
              subtitle={a.subtitle}
              severity={a.severity}
              resolved={a.status === 'closed'}
              createdAt={a.created_at}
              icon={a.type === 'near_miss' ? 'eye' : 'alert-triangle'}
              onPress={a.type === 'incident' ? () => router.push(`/incidents/${a.id}`) : undefined}
            />
          ))
      )}
    </Screen>
  );
}
