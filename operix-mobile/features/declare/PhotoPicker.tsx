import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { T } from '@/components/ui';
import type { LocalFile } from '@/services/api';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/features/theme/ThemeProvider';

/**
 * Une photo par déclaration : l'API stocke une image par incident / near-miss
 * (champ `image`, 5 Mo max). Compression à 0.6 pour rester sous la limite.
 */
export function PhotoPicker({ value, onChange }: { value: LocalFile | null; onChange: (f: LocalFile | null) => void }) {
  const theme = useTheme();
  const pick = async (source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Accès refusé', "Autorisez l'accès dans les réglages pour joindre une preuve.");
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      showAlert('Photo trop lourde', 'La preuve doit faire moins de 5 Mo.');
      return;
    }
    onChange({ uri: asset.uri, name: asset.fileName ?? `preuve-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
  };

  if (value) {
    return (
      <View className="overflow-hidden rounded-2xl border border-border bg-surface" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
        <Image source={{ uri: value.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" />
        <View className="flex-row items-center justify-between px-4 py-3">
          <View className="flex-row items-center">
            <Feather name="check-circle" size={16} color={colors.green} />
            <T variant="label" className="ml-2">
              Preuve validée
            </T>
          </View>
          <View className="flex-row" style={{ gap: 16 }}>
            <Pressable onPress={() => pick('camera')} hitSlop={8}>
              <T variant="label" className="text-green">
                Reprendre
              </T>
            </Pressable>
            <Pressable onPress={() => onChange(null)} hitSlop={8}>
              <T variant="label" className="text-muted">
                Retirer
              </T>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row" style={{ gap: 10 }}>
      <Pressable onPress={() => pick('camera')} className="flex-[2] items-center justify-center rounded-2xl border border-dashed border-green bg-green-soft py-7">
        <Feather name="camera" size={24} color={colors.green} />
        <T variant="bodyStrong" className="mt-2 text-green-dark">
          Ajouter une photo
        </T>
        <T variant="caption">Caméra</T>
      </Pressable>
      <Pressable onPress={() => pick('library')} className="flex-1 items-center justify-center rounded-2xl border border-border bg-surface py-7" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
        <Feather name="image" size={22} color={theme.colors.navy} />
        <T variant="caption" className="mt-2">
          Galerie
        </T>
      </Pressable>
    </View>
  );
}
