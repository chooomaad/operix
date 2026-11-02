import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { Button, Card, Input, SectionHeader, Select, StatusBadge, T, TopBar } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDeclare } from '@/features/declare/DeclareProvider';
import { PhotoPicker } from '@/features/declare/PhotoPicker';
import { StepHeader } from '@/features/declare/StepHeader';
import { VoiceButton } from '@/features/declare/VoiceButton';
import { submitDeclaration } from '@/features/declare/submit';
import { useCurrentLocation } from '@/hooks/useLocation';
import { useIsOnline } from '@/hooks/useNetwork';
import { useQuery } from '@/hooks/useQuery';
import { errorMessage } from '@/services/api';
import { dashboardService } from '@/services/dashboard';
import type { EventKind } from '@/types/api';
import { showAlert } from '@/lib/alert';

const KINDS: { key: EventKind; label: string; icon: keyof typeof Feather.glyphMap; ability: string }[] = [
  { key: 'incident', label: 'Incident', icon: 'alert-triangle', ability: 'incidents.create' },
  { key: 'near_miss', label: 'Near-Miss', icon: 'eye', ability: 'near_miss.create' },
  { key: 'violation', label: 'Violation', icon: 'slash', ability: 'breaches.manage' },
];

export default function DeclareScreen() {
  const { can } = useAuth();
  const online = useIsOnline();
  const { draft, setDraft, setAnalysis, setOutcome } = useDeclare();
  const { fix, status: gps, locate } = useCurrentLocation();
  const zones = useQuery('dashboard:zones', dashboardService.topZones);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fix) setDraft({ fix });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix]);

  const validate = () => {
    if (!draft.location.trim()) return "Indiquez le lieu de l'événement.";
    if (draft.description.trim().length < 10) return 'Décrivez la situation en une phrase au moins.';
    return null;
  };

  const analyze = () => {
    const v = validate();
    setError(v);
    if (v) return;
    setAnalysis(null);
    router.push('/declare/analysis');
  };

  // Sans réseau, pas d'analyse : on enregistre localement, honnêtement signalé.
  const saveOffline = async () => {
    const v = validate();
    setError(v);
    if (v) return;
    setSaving(true);
    try {
      setOutcome(await submitDeclaration(draft, null, 'medium', []));
      router.replace('/declare/success');
    } catch (e) {
      showAlert('Enregistrement impossible', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const accuracy = fix?.accuracy ? `±${Math.round(fix.accuracy)}m` : '';

  return (
    <Screen header={<TopBar title="Déclarer" back showBell={false} />}>
      <StepHeader step={draft.photo ? 2 : 1} subtitle="Informations & Preuves opérationnelles" />

      <SectionHeader title="Type d'événement" />
      <View className="flex-row" style={{ gap: 8 }}>
        {KINDS.map((k) => {
          const allowed = can(k.ability);
          const active = draft.kind === k.key;
          return (
            <Pressable
              key={k.key}
              disabled={!allowed}
              onPress={() => setDraft({ kind: k.key })}
              className={`min-h-[64px] flex-1 items-center justify-center rounded-xl border ${active ? 'border-navy bg-navy' : 'border-border bg-surface'} ${allowed ? '' : 'opacity-40'}`}
            >
              <Feather name={k.icon} size={18} color={active ? '#fff' : colors.navy} />
              <T className={`mt-1 font-semibold text-[13px] ${active ? 'text-white' : 'text-navy'}`}>{k.label}</T>
            </Pressable>
          );
        })}
      </View>
      {!can('breaches.manage') ? (
        <T variant="caption" className="mt-1.5">
          Les violations sont déclarées par l'encadrement HSSE.
        </T>
      ) : null}

      <SectionHeader title="Lieu de l'événement" />
      <Select
        value={draft.location}
        placeholder="Choisir une zone du site"
        options={(zones.data ?? []).map((z) => z.location)}
        onChange={(location) => setDraft({ location })}
        allowCustom
      />
      <Card className="-mt-1 flex-row items-center p-3">
        <Feather name="crosshair" size={16} color={gps === 'ok' ? colors.green : colors.muted} />
        <View className="ml-2.5 flex-1">
          {gps === 'ok' && fix ? (
            <>
              <T variant="label" className="text-green-dark">
                GPS vérifié {accuracy}
              </T>
              <T variant="caption">
                {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}
              </T>
            </>
          ) : (
            <T variant="caption">{gps === 'locating' ? 'Localisation en cours…' : gps === 'denied' ? 'Localisation refusée — déclaration sans GPS' : 'Position indisponible'}</T>
          )}
        </View>
        {gps !== 'ok' && gps !== 'locating' ? (
          <Pressable onPress={locate} hitSlop={8}>
            <T variant="label" className="text-green">
              Réessayer
            </T>
          </Pressable>
        ) : null}
      </Card>

      <SectionHeader title="Description de l'événement" />
      <Input
        multiline
        placeholder="Ex. Fuite d'huile hydraulique au pied du portique #02. Surface très glissante sur le passage des agents."
        value={draft.description}
        onChangeText={(description) => setDraft({ description })}
        maxLength={5000}
      />
      <VoiceButton onText={(t) => setDraft({ description: draft.description ? `${draft.description.trim()} ${t}` : t })} />

      <SectionHeader title="Preuve photo & visuelle" />
      <PhotoPicker value={draft.photo} onChange={(photo) => setDraft({ photo })} />

      <Card className="mt-6 flex-row items-center">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-blue-soft">
          <Feather name="radio" size={16} color={colors.blue} />
        </View>
        <View className="flex-1">
          <T variant="bodyStrong">Protocole Sécurité</T>
          <T variant="caption">Transmission directe à l'encadrement et aux officiers HSSE</T>
        </View>
      </Card>

      {error ? (
        <T variant="caption" className="mt-4 text-red">
          {error}
        </T>
      ) : null}

      <View className="mt-5">
        {online ? (
          <Button label="Analyser avec Operix AI" trailingIcon="arrow-right" onPress={analyze} />
        ) : (
          <>
            <StatusBadge label="Hors ligne — analyse IA indisponible" tone="orange" dot />
            <Button className="mt-3" kind="dark" icon="save" label="Enregistrer localement" onPress={saveOffline} loading={saving} />
          </>
        )}
      </View>
      <View className="mt-4 flex-row items-center justify-center">
        <Feather name="lock" size={12} color={colors.faint} />
        <T variant="caption" className="ml-1.5 text-faint">
          Enregistrement sécurisé hors-ligne activé
        </T>
      </View>
    </Screen>
  );
}
