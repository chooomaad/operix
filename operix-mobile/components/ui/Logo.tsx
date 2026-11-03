import { Image, View } from 'react-native';
import { T } from './Text';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/operix-mark.png')}
      accessibilityLabel="Logo OPERIX"
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

export function Logo({ size = 32, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <View>
      <Image
        source={require('@/assets/operix-logo.png')}
        accessibilityLabel="OPERIX"
        resizeMode="contain"
        style={{ width: size * 2.15, height: size * 1.43 }}
      />
      {subtitle ? <T variant="caption">{subtitle}</T> : null}
    </View>
  );
}
