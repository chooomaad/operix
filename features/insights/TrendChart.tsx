import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';
import { T } from '@/components/ui';

interface Point {
  label: string;
  value: number;
  projected: boolean;
}

/** Courbe simple : réel en trait plein vert, projection en pointillé bleu. */
export function TrendChart({ points }: { points: Point[] }) {
  const [w, setW] = useState(0);
  const h = 150;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);

  const realIdx = points.map((p, i) => (!p.projected ? i : -1)).filter((i) => i >= 0);
  const lastReal = realIdx[realIdx.length - 1] ?? 0;
  const path = (idx: number[]) => idx.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i)},${y(points[i]?.value ?? 0)}`).join(' ');
  const projIdx = [lastReal, ...points.map((p, i) => (p.projected ? i : -1)).filter((i) => i >= 0)];

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + f * (h - pad.t - pad.b)} y2={pad.t + f * (h - pad.t - pad.b)} stroke={colors.divider} strokeWidth={1} />
          ))}
          <Path d={path(realIdx)} stroke={colors.green} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          <Path d={path(projIdx)} stroke={colors.blue} strokeWidth={2} strokeDasharray="5 5" fill="none" />
          {points.map((p, i) => (
            <Circle key={`c${i}`} cx={x(i)} cy={y(p.value)} r={3.2} fill={p.projected ? colors.surface : colors.green} stroke={p.projected ? colors.blue : colors.green} strokeWidth={1.5} />
          ))}
          {points.map((p, i) => (
            <SvgText key={`t${i}`} x={x(i)} y={h - 6} fontSize={10} fontFamily={fonts.medium} fill={colors.faint} textAnchor="middle">
              {p.label}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height: h }} />
      )}
      <View className="mt-2 flex-row" style={{ gap: 16 }}>
        <View className="flex-row items-center">
          <View className="mr-1.5 h-0.5 w-4 bg-green" />
          <T variant="caption">Incidents réels</T>
        </View>
        <View className="flex-row items-center">
          <View className="mr-1.5 h-0.5 w-4 bg-blue" />
          <T variant="caption">Projection linéaire</T>
        </View>
      </View>
    </View>
  );
}
