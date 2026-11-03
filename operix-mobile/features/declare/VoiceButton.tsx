import { Feather } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { colors } from '@/constants/theme';
import { T } from '@/components/ui';
import { showAlert } from '@/lib/alert';

/**
 * Dictée vocale : reconnaissance vocale de l'appareil (fr-FR), le texte est
 * ajouté à la description. Aucune donnée audio n'est envoyée à operix-api.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [speechModule, setSpeechModule] = useState<ExpoSpeechRecognitionModuleType | null>(() =>
    Platform.OS === 'web'
      ? null
      : requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>('ExpoSpeechRecognition'),
  );
  const [webModuleLoading, setWebModuleLoading] = useState(Platform.OS === 'web');
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let active = true;
    import('expo-speech-recognition')
      .then(({ ExpoSpeechRecognitionModule }) => {
        if (active) setSpeechModule(ExpoSpeechRecognitionModule);
      })
      .catch((error: unknown) => {
        console.error('Unable to load browser speech recognition.', error);
      })
      .finally(() => {
        if (active) setWebModuleLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!speechModule) return;

    const subscriptions = [
      speechModule.addListener('start', () => setListening(true)),
      speechModule.addListener('end', () => setListening(false)),
      speechModule.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript;
        if (transcript && event.isFinal) onTextRef.current(transcript);
      }),
      speechModule.addListener('error', () => setListening(false)),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [speechModule]);

  const toggle = async () => {
    if (!speechModule) return;
    if (listening) {
      speechModule.stop();
      return;
    }

    try {
      const perm = await speechModule.requestPermissionsAsync();
      if (!perm.granted) {
        showAlert('Micro indisponible', 'Autorisez le micro pour dicter votre constat.');
        return;
      }
      speechModule.start({ lang: 'fr-FR', interimResults: false, continuous: false });
    } catch (error) {
      showAlert(
        'Dictée vocale indisponible',
        error instanceof Error ? error.message : 'La reconnaissance vocale n’a pas pu démarrer.',
      );
    }
  };

  return (
    <Pressable
      disabled={!speechModule}
      onPress={toggle}
      className={`mt-[-6px] flex-row items-center self-start rounded-full px-3.5 py-2 ${listening ? 'bg-red-soft' : 'bg-blue-soft'} ${speechModule ? '' : 'opacity-60'}`}
    >
      <Feather name={listening ? 'square' : 'mic'} size={14} color={listening ? colors.red : colors.blue} />
      <T className={`ml-2 font-semibold text-[12px] ${listening ? 'text-red' : 'text-blue'}`}>
        {listening
          ? 'Écoute… toucher pour arrêter'
          : speechModule
            ? 'Décrire vocalement'
            : webModuleLoading
              ? 'Chargement de la dictée…'
              : Platform.OS === 'web'
                ? 'Dictée vocale indisponible sur cet appareil'
                : 'Dictée vocale — build de développement requis'}
      </T>
    </Pressable>
  );
}
