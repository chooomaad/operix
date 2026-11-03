import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '@/constants/theme';
import { T } from './Text';

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: keyof typeof Feather.glyphMap;
}

export function Input({ label, hint, error, icon, multiline, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const border = error ? colors.red : focused ? colors.green : colors.border;
  return (
    <View className="mb-4">
      {label ? (
        <T variant="label" className="mb-1.5">
          {label}
        </T>
      ) : null}
      <View className="flex-row rounded-xl bg-bg px-3.5" style={{ borderWidth: 1, borderColor: border, alignItems: multiline ? 'flex-start' : 'center' }}>
        {icon ? <Feather name={icon} size={17} color={colors.faint} style={{ marginRight: 10, marginTop: multiline ? 14 : 0 }} /> : null}
        <TextInput
          placeholderTextColor={colors.faint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          className="flex-1 font-regular text-[15px] text-ink"
          style={[{ minHeight: multiline ? 120 : 50, paddingVertical: multiline ? 12 : 0 }, style]}
          {...rest}
        />
      </View>
      {error ? (
        <T variant="caption" className="mt-1 text-red">
          {error}
        </T>
      ) : hint ? (
        <T variant="caption" className="mt-1">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

interface SelectProps {
  label?: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
  /** Autorise une valeur saisie librement (lieu absent de la liste). */
  allowCustom?: boolean;
}

export function Select({ label, value, options, placeholder = 'Sélectionner', onChange, allowCustom }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  return (
    <View className="mb-4">
      {label ? (
        <T variant="label" className="mb-1.5">
          {label}
        </T>
      ) : null}
      <Pressable onPress={() => setOpen(true)} className="min-h-[50px] flex-row items-center rounded-xl border border-border bg-bg px-3.5">
        <Feather name="map-pin" size={17} color={colors.green} style={{ marginRight: 10 }} />
        <T variant="body" className={`flex-1 ${value ? '' : 'text-faint'}`} numberOfLines={1}>
          {value || placeholder}
        </T>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="max-h-[70%] rounded-t-3xl bg-surface px-5 pb-8 pt-4">
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />
          <T variant="heading" className="mb-3">
            {label ?? placeholder}
          </T>
          {allowCustom ? (
            <View className="mb-2 flex-row items-center">
              <TextInput
                value={custom}
                onChangeText={setCustom}
                placeholder="Autre lieu…"
                placeholderTextColor={colors.faint}
                className="mr-2 h-12 flex-1 rounded-xl border border-border bg-bg px-3 font-regular text-[15px] text-ink"
              />
              <Pressable
                onPress={() => {
                  if (custom.trim()) {
                    onChange(custom.trim());
                    setOpen(false);
                  }
                }}
                className="h-12 w-12 items-center justify-center rounded-xl bg-green"
              >
                <Feather name="check" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : null}
          <FlatList
            data={options}
            keyExtractor={(o) => o}
            ListEmptyComponent={<T variant="caption">Aucun lieu enregistré — saisissez-le ci-dessus.</T>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className="flex-row items-center border-b border-divider py-3.5"
              >
                <T variant="body" className="flex-1">
                  {item}
                </T>
                {item === value ? <Feather name="check" size={18} color={colors.green} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
