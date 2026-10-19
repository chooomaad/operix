import { Text as RNText, type TextProps } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'overline' | 'label';

const variants: Record<Variant, string> = {
  display: 'font-bold text-[26px] leading-[32px] text-navy',
  title: 'font-bold text-[20px] leading-[26px] text-navy',
  heading: 'font-semibold text-[16px] leading-[22px] text-navy',
  body: 'font-regular text-[14px] leading-[21px] text-ink',
  bodyStrong: 'font-semibold text-[14px] leading-[20px] text-ink',
  caption: 'font-regular text-[12px] leading-[17px] text-muted',
  overline: 'font-semibold text-[11px] leading-[14px] tracking-[1px] uppercase text-muted',
  label: 'font-medium text-[13px] leading-[18px] text-navy',
};

export function T({ variant = 'body', className = '', ...rest }: TextProps & { variant?: Variant; className?: string }) {
  return <RNText {...rest} className={`${variants[variant]} ${className}`} />;
}
