import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Coffre sécurisé de l'appareil (Keystore Android / Keychain iOS).
 *
 * expo-secure-store n'existe pas sur le web : la version navigateur (démo,
 * recette sur ordinateur) se rabat sur localStorage. Sur téléphone, rien ne
 * change : le jeton reste dans le coffre chiffré.
 */
const web = Platform.OS === 'web';

function local(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (web) return local()?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (web) {
      local()?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (web) {
      local()?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
