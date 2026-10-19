import { Feather } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { colors } from '@/constants/theme';
import { T } from '@/components/ui';

/**
 * Dictée vocale : reconnaissance vocale de l'appareil (fr-FR), le texte est
 * ajouté à la description. Aucune donnée audio n'est envoyée à operix-api.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const finalText = useRef('');

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results[0]?.transcript;
    if (t && e.isFinal) {
      finalText.current = t;
      onText(t);
    }
  });
  useSpeechRecognitionEvent('error', () => setListening(false));

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Micro indisponible', 'Autorisez le micro pour dicter votre constat.');
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'fr-FR', interimResults: false, continuous: false });
  };

  return (
    <Pressable onPress={toggle} className={`mt-[-6px] flex-row items-center self-start rounded-full px-3.5 py-2 ${listening ? 'bg-red-soft' : 'bg-blue-soft'}`}>
      <Feather name={listening ? 'square' : 'mic'} size={14} color={listening ? colors.red : colors.blue} />
      <T className={`ml-2 font-semibold text-[12px] ${listening ? 'text-red' : 'text-blue'}`}>{listening ? 'Écoute… toucher pour arrêter' : 'Décrire vocalement'}</T>
    </Pressable>
  );
}
