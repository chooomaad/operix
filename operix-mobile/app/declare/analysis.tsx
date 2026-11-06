import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { ActionCard } from '@/components/ActionCard';
import { Screen } from '@/components/Screen';
import { Button, Card, ErrorState, SectionHeader, SeverityBadge, StatusBadge, T, TopBar } from '@/components/ui';
import { useDeclare } from '@/features/declare/DeclareProvider';
import { StepHeader } from '@/features/declare/StepHeader';
import { submitDeclaration } from '@/features/declare/submit';
import { severityLabel } from '@/lib/labels';
import { aiService } from '@/services/ai';
import { errorMessage } from '@/services/api';
import type { Severity } from '@/types/api';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/features/theme/ThemeProvider';

const LEVELS: Severity[] = ['low', 'medium', 'high', 'critical'];

function Analyzing() {
  return (
    <Card className="mt-4 items-center py-10">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-soft">
        <Feather name="cpu" size={22} color={colors.blue} />
      </View>
      <T variant="heading" className="mt-4">
        Analyse en cours…
      </T>
      <T variant="caption" className="mt-1 text-center">
        Classification, niveau de risque, causes probables et plan d'actions.
      </T>
    </Card>
  );
}

export default function AnalysisScreen() {
  const theme = useTheme();
  const { draft, analysis, setAnalysis, setOutcome } = useDeclare();
  const [error, setError] = useState<unknown>(null);
  const [severity, setSeverity] = useState<Severity>('medium');
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);

  const run = useCallback(async () => {
    setError(null);
    try {
      const a = await aiService.analyze({ description: draft.description, location: draft.location, event_type: draft.kind }, draft.photo);
      setAnalysis(a);
      setSeverity(a.risk_level);
    } catch (e) {
      setError(e);
    }
  }, [draft, setAnalysis]);

  useEffect(() => {
    if (!analysis) void run();
    else setSeverity(analysis.risk_level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      setOutcome(await submitDeclaration(draft, analysis, severity, analysis.actions));
      router.replace('/declare/success');
    } catch (e) {
      showAlert('Enregistrement impossible', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const isAi = analysis?.engine === 'ai';
  const deployLabel = draft.kind === 'incident' ? `Valider & Déployer les ${analysis?.actions.length ?? 0} actions` : 'Valider la déclaration';

  return (
    <Screen header={<TopBar title="Déclarer" back showBell={false} />}>
      <StepHeader step={3} subtitle="Analyse IA" />

      <View className="mt-5 flex-row items-center self-start rounded-full bg-navy px-3 py-1.5">
        <View className="mr-2 h-1.5 w-1.5 rounded-full bg-green" />
        <T className="font-semibold text-[10px] tracking-[0.8px] text-white">
          {isAi ? 'OPERIX AI ENGINE' : analysis ? 'OPERIX • MOTEUR DE RÈGLES' : 'OPERIX AI ENGINE'}
          {analysis?.model ? ` • ${analysis.model.toUpperCase()}` : ''}
        </T>
      </View>
      <View className="mt-3 flex-row items-end justify-between">
        <View className="flex-1 pr-3">
          <T variant="title">Analyse Operix AI</T>
          <T variant="caption" className="mt-0.5">
            Évaluation intelligente du risque et plan d'actions préventives
          </T>
        </View>
        {analysis ? (
          <View className="items-end">
            <T className="font-bold text-[18px] text-blue">{(analysis.duration_ms / 1000).toFixed(1)}s</T>
            <T variant="caption">d'analyse</T>
          </View>
        ) : null}
      </View>

      {!analysis && !error ? <Analyzing /> : null}
      {error ? <ErrorState message={errorMessage(error, "L'analyse n'a pas abouti.")} onRetry={run} /> : null}

      {analysis ? (
        <>
          {!isAi ? (
            <View className="mt-4 rounded-xl bg-orange-soft p-3">
              <T variant="caption" className="text-orange">
                {analysis.fallback_reason === 'provider_unavailable'
                  ? 'Le fournisseur IA est configuré mais ne répond pas. Cette analyse vient du moteur de règles et doit être confirmée par le superviseur. Vérifiez la clé et le modèle IA dans les secrets Supabase.'
                  : analysis.fallback_reason === 'rules_selected'
                    ? 'Le serveur est configuré pour utiliser le moteur de règles. Cette analyse doit être confirmée par le superviseur.'
                    : 'Aucune clé de fournisseur IA n’est configurée sur le serveur. Cette analyse vient du moteur de règles et doit être confirmée par le superviseur.'}
              </T>
            </View>
          ) : null}

          <Card className="mt-4 p-5">
            <View className="flex-row items-center justify-between">
              <T variant="overline">Incident identifié & catégorisé</T>
              <SeverityBadge severity={severity} prefix="Risque " />
            </View>
            <T variant="title" className="mt-3">
              {analysis.category}
            </T>
            {analysis.subcategory ? (
              <T variant="body" className="text-muted">
                {analysis.subcategory}
              </T>
            ) : null}
            <View className="mt-3 flex-row items-center">
              <Feather name="map-pin" size={13} color={colors.muted} />
              <T variant="caption" className="ml-1.5">
                {draft.location}
              </T>
            </View>
            {draft.photo ? <Image source={{ uri: draft.photo.uri }} style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 14 }} contentFit="cover" /> : null}
            {analysis.summary ? (
              <T variant="caption" className="mt-3">
                {analysis.summary}
              </T>
            ) : null}
          </Card>

          {adjusting ? (
            <Card className="mt-3">
              <T variant="label">Ajuster le niveau de risque</T>
              <View className="mt-3 flex-row" style={{ gap: 6 }}>
                {LEVELS.filter((l) => draft.kind !== 'near_miss' || l !== 'critical').map((l) => (
                  <Pressable key={l} onPress={() => setSeverity(l)} className={`min-h-[44px] flex-1 items-center justify-center rounded-lg border ${severity === l ? 'border-navy bg-navy' : 'border-border'}`} style={{ backgroundColor: severity === l ? theme.colors.navy : 'transparent', borderColor: severity === l ? theme.colors.navy : theme.colors.border }}>
                    <T className={`font-semibold text-[12px] ${severity === l ? 'text-white' : 'text-navy'}`}>{severityLabel[l]}</T>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}

          <SectionHeader title="Risques détectés" />
          {analysis.risks.map((r, i) => (
            <Card key={r} className="mb-2 flex-row items-center p-3.5">
              <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-red-soft">
                <T className="font-bold text-[12px] text-red">{i + 1}</T>
              </View>
              <T variant="body" className="flex-1">
                {r}
              </T>
            </Card>
          ))}

          <SectionHeader title="Causes probables identifiées" right={<StatusBadge label={`${analysis.confidence}% certitude`} tone="blue" />} />
          <Card>
            {analysis.causes.map((c, i) => (
              <View key={c} className={`flex-row py-2 ${i > 0 ? 'border-t border-divider' : ''}`}>
                <T className="w-6 font-bold text-[14px] text-blue">{i + 1}.</T>
                <T variant="body" className="flex-1">
                  {c}
                </T>
              </View>
            ))}
          </Card>

          <SectionHeader title="Actions recommandées" right={<StatusBadge label={`${analysis.actions.length} actions`} tone="green" />} />
          {analysis.actions.map((a, i) => (
            <ActionCard key={`${a.description}-${i}`} index={i + 1} priority={a.priority} delayMinutes={a.delay_minutes} responsible={a.responsible_role} description={a.description} />
          ))}

          <View className="mt-5" style={{ gap: 10 }}>
            <Button label={deployLabel} trailingIcon="arrow-right" onPress={validate} loading={saving} />
            <Button kind="secondary" icon="sliders" label="Ajuster l'analyse / Modifier le risque" onPress={() => setAdjusting((v) => !v)} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
