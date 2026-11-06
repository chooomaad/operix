import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useTheme } from '@/features/theme/ThemeProvider';
import { T } from './Text';

type Kind = 'primary' | 'secondary' | 'ghost' | 'dark';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  icon?: keyof typeof Feather.glyphMap;
  trailingIcon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const styles: Record<Kind, { box: string; text: string; color: string }> = {
  primary: { box: 'bg-green', text: 'text-white', color: '#FFFFFF' },
  dark: { box: 'bg-navy', text: 'text-white', color: '#FFFFFF' },
  secondary: { box: 'bg-surface border border-border', text: 'text-navy', color: colors.navy },
  ghost: { box: 'bg-transparent', text: 'text-green', color: colors.green },
};

export function Button({ label, onPress, kind = 'primary', icon, trailingIcon, loading, disabled, className = '' }: ButtonProps) {
  const theme = useTheme();
  const s = styles[kind];
  const off = disabled || loading;
  const buttonColor = kind === 'dark' && theme.scheme === 'dark' ? theme.colors.navySoft : kind === 'dark' ? colors.navy : undefined;
  const textColor = kind === 'secondary' ? theme.colors.navy : s.color;
  const background = kind === 'secondary'
    ? theme.colors.surface
    : buttonColor ?? (kind === 'primary' && theme.scheme === 'dark' ? '#08714D' : undefined);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={off ? undefined : onPress}
      className={`min-h-[52px] flex-row items-center justify-center rounded-xl px-5 ${s.box} ${off ? 'opacity-50' : ''} ${className}`}
      style={({ pressed }) => ({ backgroundColor: background, borderColor: kind === 'secondary' ? theme.colors.border : undefined, opacity: pressed && !off ? 0.85 : undefined })}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View className="flex-row items-center">
          {icon ? <Feather name={icon} size={18} color={textColor} style={{ marginRight: 8 }} /> : null}
          <T variant="bodyStrong" className={`${s.text} text-[15px]`}>
            {label}
          </T>
          {trailingIcon ? <Feather name={trailingIcon} size={18} color={textColor} style={{ marginLeft: 8 }} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export const PrimaryButton = (p: Omit<ButtonProps, 'kind'>) => <Button {...p} kind="primary" />;
export const SecondaryButton = (p: Omit<ButtonProps, 'kind'>) => <Button {...p} kind="secondary" />;
