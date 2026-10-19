import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { Button, Card, KeyValue, SeverityBadge, StatusBadge, T } from '@/components/ui';
import { useDeclare } from '@/features/declare/DeclareProvider';
import { formatDelay } from '@/lib/format';
import { priorityLabel } from '@/lib/labels';

const KIND_LABEL = { incident: 'Incident enregistré !', near_miss: 'Near-miss enregistré !', violation: 'Violation enregistrée !' } as const;

export default function SuccessScreen() {
  const { draft, analysis, outcome, reset } = useDeclare();

  const home = () => {
    reset();
    router.replace('/');
  };
  const again = () => {
    reset();
    router.replace('/declare');
  };

  if (!outcome) {
    return (
      <Screen>
        <Button className="mt-10" label="Retour à l'accueil" onPress={home} />
      </Screen>
    );
  }

  const isAi = analysis?.engine === 'ai';

  return (
    <Screen>
      <View className="mt-10 items-center">
        <View className={`h-20 w-20 items-center justify-center rounded-full ${outcome.offline ? 'bg-blue-soft' : 'bg-green-soft'}`}>
          <View className={`h-14 w-14 items-center justify-center rounded-full ${outcome.offline ? 'bg-blue' : 'bg-green'}`}>
            <Feather name={outcome.offline ? 'download' : 'check'} size={30} color="#fff" />
          </View>
        </View>
        <T variant="display" className="mt-5 text-center">
          {outcome.offline ? 'Enregistré localement' : KIND_LABEL[outcome.kind]}
        </T>
        <T variant="body" className="mt-2 text-center text-muted">
          {outcome.offline
            ? 'Aucun réseau : la déclaration sera transmise automatiquement dès le retour de la connexion.'
            : analysis
              ? `${isAi ? 'Operix AI' : 'Le moteur de règles'} a analysé votre déclaration ; les données sont synchronisées avec la plateforme.`
              : 'Votre déclaration est synchronisée avec la plateforme.'}
        </T>
      </View>

      <Card className="mt-6">
        <View className="flex-row items-center justify-between">
          <View>
            <T variant="overline">Référence</T>
            <T variant="title" className="mt-1">
              {outcome.reference ?? 'En attente de synchronisation'}
            </T>
          </View>
          {analysis ? <SeverityBadge severity={outcome.incident?.severity ?? analysis.risk_level} prefix="Risque " /> : null}
        </View>
        <View className="mt-3 border-t border-divider pt-2">
          <KeyValue label="Zone d'intervention" value={draft.location || '—'} />
          <KeyValue label="Transmission" value={outcome.offline ? 'File locale' : 'Encadrement & officiers HSSE notifiés'} />
          {draft.fix ? <KeyValue label="Position" value={`${draft.fix.latitude.toFixed(4)}, ${draft.fix.longitude.toFixed(4)}`} /> : null}
        </View>
      </Card>

      {outcome.actions.length > 0 ? (
        <View className="mt-4 rounded-2xl bg-blue p-5">
          <View className="flex-row items-center">
            <Feather name="cpu" size={14} color="#fff" />
            <T className="ml-2 font-semibold text-[11px] tracking-[0.8px] text-white">{isAi ? 'OPERIX AI ENGINE' : 'OPERIX • MOTEUR DE RÈGLES'}</T>
          </View>
          <T variant="heading" className="mt-2 text-white">
            {outcome.actions.length} actions préventives générées automatiquement
          </T>
          <View className="mt-3" style={{ gap: 8 }}>
            {outcome.actions.map((a) => (
              <View key={a.id} className="flex-row items-start">
                <Feather name="check-circle" size={14} color="#BFD3FF" style={{ marginTop: 2 }} />
                <T className="ml-2 flex-1 font-regular text-[13px] leading-[19px] text-white">
                  <T className="font-semibold text-white">
                    {priorityLabel[a.priority]} • {formatDelay(a.delay_minutes)} —{' '}
                  </T>
                  {a.description}
                </T>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="mt-6" style={{ gap: 10 }}>
        {outcome.kind === 'incident' && outcome.recordId ? (
          <Button
            label="Voir les recommandations & timeline"
            trailingIcon="arrow-right"
            onPress={() => {
              const id = outcome.recordId;
              reset();
              router.replace(`/incidents/${id}`);
            }}
          />
        ) : null}
        <Button kind="secondary" icon="home" label="Retour à l'accueil terrain" onPress={home} />
        <Pressable onPress={again} className="items-center py-2">
          <T variant="label" className="text-green">
            + Déclarer un autre événement (&lt; 60s)
          </T>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-center">
        <Feather name="shield" size={12} color={colors.faint} />
        <T variant="caption" className="ml-1.5 text-faint">
          Journal d'audit horodaté côté serveur
        </T>
      </View>
      {outcome.offline ? <StatusBadge label="Hors ligne" tone="neutral" /> : null}
    </Screen>
  );
}
