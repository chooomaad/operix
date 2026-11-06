import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { AIInsightCard } from '@/components/AIInsightCard';
import { FilterChips } from '@/components/FilterChips';
import { Screen } from '@/components/Screen';
import { Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar, SectionHeader, StatusBadge, T, TopBar } from '@/components/ui';
import type { InsightPeriod } from '@/features/insights/computeInsights';
import { TrendChart } from '@/features/insights/TrendChart';
import { useQuery } from '@/hooks/useQuery';
import { useUnreadCount } from '@/hooks/useUnread';
import { errorMessage } from '@/services/api';
import { loadInsights } from '@/services/insights';
import { useTheme } from '@/features/theme/ThemeProvider';

const PERIODS: { key: InsightPeriod; label: string }[] = [
  { key: '7J', label: '7J' },
  { key: '30J', label: '30J' },
  { key: 'Trimestre', label: 'Trimestre' },
  { key: 'Année', label: 'Année' },
];

const ZONE_COLORS = [colors.red, colors.orange, colors.blue, colors.faint];

export default function InsightsScreen() {
  const theme = useTheme();
  const unread = useUnreadCount();
  const [period, setPeriod] = useState<InsightPeriod>('30J');
  const q = useQuery(`insights:${period}`, () => loadInsights(period));
  const d = q.data;

  const controlled = d ? d.preventionIndex >= 70 : true;

  return (
    <Screen header={<TopBar title="Intelligence" unread={unread} />} tabBarSpace refreshing={q.refreshing} onRefresh={q.refresh}>
      <StatusBadge label="Données live • operix-api" tone="blue" dot />
      <T variant="display" className="mt-3">
        Sécurité Prédictive
      </T>
      <T variant="body" className="mt-1 text-muted">
        From incident reporting to intelligent prevention.
      </T>

      <View className="mt-4">
        <FilterChips options={PERIODS} value={period} onChange={setPeriod} />
      </View>

      {q.loading ? (
        <LoadingState label="Calcul des indicateurs…" />
      ) : !d ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refresh} />
      ) : (
        <>
          <View className="mt-4 rounded-2xl bg-navy p-5" style={{ backgroundColor: theme.scheme === 'dark' ? theme.colors.navySoft : '#1E2A3D' }}>
            <T className="font-semibold text-[11px] tracking-[1px] text-[#AEB7C7]">INDICE DE PRÉVENTION GLOBALE</T>
            <View className="mt-2 flex-row items-end">
              <T className="font-bold text-[44px] leading-[48px] text-white">{d.preventionIndex}</T>
              <T className="mb-1.5 ml-1 font-medium text-[16px] text-[#AEB7C7]">/ 100</T>
              <View className="flex-1" />
              <View className={`mb-2 rounded-full px-2.5 py-1 ${d.deltaVsPrevious <= 0 ? 'bg-green' : 'bg-orange'}`}>
                <T className="font-semibold text-[11px] text-white">
                  {d.deltaVsPrevious <= 0 ? '' : '+'}
                  {d.deltaVsPrevious} incidents vs période préc.
                </T>
              </View>
            </View>
            <View className="mt-3">
              <ProgressBar value={d.preventionIndex} color={controlled ? colors.green : colors.orange} />
            </View>
            <View className="mt-3 flex-row items-center">
              <Feather name={controlled ? 'shield' : 'alert-triangle'} size={14} color={controlled ? '#5FD3A5' : '#F5B66B'} />
              <T className="ml-1.5 font-semibold text-[13px] text-white">{controlled ? 'Risque sous contrôle' : 'Vigilance renforcée'}</T>
            </View>
            <T className="mt-2 font-regular text-[12px] text-[#AEB7C7]">
              {d.potentialNeutralized} situation(s) dangereuse(s) signalée(s) avant accident sur la période.
            </T>
          </View>
          <T variant="caption" className="mt-1.5 text-faint">
            Indice = 40 × culture du signalement + 30 × actions terminées + 30 × gravité maîtrisée.
          </T>

          <SectionHeader title="Trajectoire des risques & projections" />
          <Card>
            <TrendChart points={d.trend} />
          </Card>

          <SectionHeader title="Cartographie des zones critiques" />
          <Card>
            {d.zones.length === 0 ? (
              <T variant="caption">Aucun événement localisé sur la période.</T>
            ) : (
              d.zones.map((z, i) => (
                <View key={z.location} className={i > 0 ? 'mt-4' : ''}>
                  <View className="mb-1.5 flex-row justify-between">
                    <T variant="label" numberOfLines={1} className="flex-1 pr-2">
                      {z.location}
                    </T>
                    <T variant="label">{z.share}%</T>
                  </View>
                  <ProgressBar value={z.share} color={ZONE_COLORS[i] ?? colors.faint} />
                </View>
              ))
            )}
          </Card>

          <SectionHeader title="Insights clés détectés" />
          {d.highShare > 0 ? (
            <AIInsightCard
              eyebrow="Risque récurrent détecté"
              tone="orange"
              title={`${d.highShare}% des incidents classés élevés ou critiques`}
              text={d.zones[0] ? `La zone « ${d.zones[0].location} » concentre ${d.zones[0].share}% des événements de la période.` : 'Concentration à surveiller.'}
              link="Voir les incidents"
              onLink={() => router.push('/incidents')}
            />
          ) : null}
          {d.overdueActions > 0 || d.openActions > 0 ? (
            <AIInsightCard
              eyebrow="Dérive prédictive"
              tone="blue"
              title={`${d.openActions} action(s) ouverte(s), dont ${d.overdueActions} en retard`}
              text="Une action en retard laisse le danger en place : priorisez les échéances dépassées."
              link="Voir les actions"
              onLink={() => router.push('/actions')}
            />
          ) : null}
          {d.avgCloseHours !== null ? (
            <AIInsightCard
              eyebrow="Victoire opérationnelle"
              tone="green"
              title={`Délai moyen de réalisation : ${d.avgCloseHours < 1 ? `${Math.round(d.avgCloseHours * 60)} min` : `${d.avgCloseHours.toFixed(1)} h`}`}
              text="Temps moyen entre le déploiement d'une action et sa validation terrain."
            />
          ) : null}
          {d.highShare === 0 && d.openActions === 0 && d.avgCloseHours === null ? (
            <EmptyState icon="activity" title="Pas encore assez de données" text="Les insights apparaissent dès les premières déclarations analysées." />
          ) : null}

          <SectionHeader title="Causes racines prédominantes" />
          <Card>
            {d.categories.length === 0 ? (
              <T variant="caption">Aucune analyse Operix sur la période.</T>
            ) : (
              d.categories.map((c, i) => (
                <View key={c.label} className={`flex-row items-center ${i > 0 ? 'mt-3' : ''}`}>
                  <T className="w-14 font-bold text-[20px] text-navy">{c.share}%</T>
                  <T variant="body" className="flex-1">
                    {c.label}
                  </T>
                </View>
              ))
            )}
          </Card>

          <Button className="mt-6" kind="secondary" icon="file-text" label="Voir le registre des incidents" onPress={() => router.push('/incidents')} />
        </>
      )}
    </Screen>
  );
}
