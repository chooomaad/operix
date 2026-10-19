import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { T } from './ui/Text';

/** Ne s'affiche que s'il y a quelque chose à dire : hors-ligne, ou envois en attente. */
export function OfflineBanner() {
  const { online, pending, syncing, sync } = useOfflineQueue();
  if (online && pending === 0) return null;

  const text = !online
    ? pending > 0
      ? `Hors ligne • ${pending} déclaration${pending > 1 ? 's' : ''} enregistrée${pending > 1 ? 's' : ''} localement`
      : 'Hors ligne • les déclarations seront enregistrées localement'
    : syncing
      ? 'Synchronisation…'
      : `${pending} déclaration${pending > 1 ? 's' : ''} en attente d'envoi`;

  return (
    <Pressable onPress={online ? sync : undefined} className={`mx-4 mb-2 flex-row items-center rounded-xl px-3 py-2 ${online ? 'bg-blue-soft' : 'bg-navy'}`}>
      <Feather name={online ? 'refresh-cw' : 'wifi-off'} size={14} color={online ? '#2459D6' : '#FFFFFF'} />
      <T className={`ml-2 flex-1 font-medium text-[12px] ${online ? 'text-blue' : 'text-white'}`}>{text}</T>
      {online && !syncing ? <T className="font-semibold text-[12px] text-blue">Envoyer</T> : null}
    </Pressable>
  );
}
