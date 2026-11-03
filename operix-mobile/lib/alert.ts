import { Alert, Platform } from 'react-native';

/**
 * Alert.alert ne fait rien dans un navigateur (react-native-web) : sur le web,
 * on passe par les boîtes de dialogue du navigateur. Sur téléphone, rien ne change.
 */
const web = Platform.OS === 'web';

export function showAlert(title: string, message?: string): void {
  if (web) {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Demande de confirmation ; `onConfirm` n'est appelé que si l'utilisateur valide. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void): void {
  if (web) {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
