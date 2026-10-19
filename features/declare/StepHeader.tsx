import { View } from 'react-native';
import { Card, StatusBadge, T } from '@/components/ui';

const STEPS = ['Saisie', 'Preuves', 'Analyse IA'];

export function StepHeader({ step, subtitle }: { step: 1 | 2 | 3; subtitle: string }) {
  return (
    <Card className="mt-2">
      <View className="flex-row items-center justify-between">
        <T variant="overline">Étape {step} sur 3</T>
        <StatusBadge label="Mode express <60s" tone="green" dot />
      </View>
      <T variant="heading" className="mt-2">
        {subtitle}
      </T>
      <View className="mt-3 flex-row" style={{ gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} className="flex-1">
            <View className={`h-1 rounded-full ${i < step ? 'bg-green' : 'bg-divider'}`} />
            <T variant="caption" className={`mt-1.5 text-[11px] ${i < step ? 'font-semibold text-navy' : ''}`}>
              {i + 1}. {s}
            </T>
          </View>
        ))}
      </View>
    </Card>
  );
}
