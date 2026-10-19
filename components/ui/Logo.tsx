import Svg, { Circle, Path } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { T } from './Text';

/** Bouclier navy, nœud technologique vert au centre. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 3 L42 10 V23 C42 34 34.5 41.5 24 45 C13.5 41.5 6 34 6 23 V10 Z" fill={colors.navy} />
      <Path d="M24 15 V20 M24 28 V33 M15 24 H20 M28 24 H33" stroke={colors.green} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={24} cy={24} r={4.2} fill={colors.green} />
    </Svg>
  );
}

export function Logo({ size = 32, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <View className="flex-row items-center">
      <LogoMark size={size} />
      <View className="ml-2.5">
        <T className="font-bold text-navy tracking-[2px]" style={{ fontSize: size * 0.58, lineHeight: size * 0.7 }}>
          OPERIX
        </T>
        {subtitle ? <T variant="caption">{subtitle}</T> : null}
      </View>
    </View>
  );
}
