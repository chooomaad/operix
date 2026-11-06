import { Feather } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { colors } from '@/constants/theme';
import { T } from '@/components/ui';

/**
 * Dictée vocale : reconnaissance vocale de l'appareil (fr-FR), le texte est
 * ajouté à la description. Aucune donnée audio n'est envoyée à operix-api.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [speechModule, setSpeechModule] = useState<ExpoSpeechRecognitionModuleType | null>(() =>
    Platform.OS === 'web'
      ? null
      : requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>('ExpoSpeechRecognition'),
  );
  const [webModuleLoading, setWebModuleLoading] = useState(Platform.OS === 'web');
  const onTextRef = useRef(onText);
  const transcriptReceived = useRef(false);

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
      speechModule.addListener('end', () => {
        setListening(false);
        if (!transcriptReceived.current) setVoiceError("Aucune voix n'a été reconnue. Réessayez dans un endroit calme.");
      }),
      speechModule.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript;
        if (transcript && event.isFinal) {
          transcriptReceived.current = true;
          setVoiceError('');
          onTextRef.current(transcript);
        }
      }),
      speechModule.addListener('error', (event) => {
        setListening(false);
        const messages: Record<string, string> = {
          'not-allowed': 'Autorisez le microphone et la reconnaissance vocale dans les réglages de votre appareil.',
          'service-not-allowed': 'Aucun service de reconnaissance vocale n’est disponible sur cet appareil.',
          'language-not-supported': 'La reconnaissance vocale en français n’est pas disponible sur cet appareil.',
          network: 'La reconnaissance vocale nécessite une connexion réseau sur cet appareil.',
          'no-speech': "Aucune voix n'a été détectée. Touchez le micro et parlez après le signal.",
          'audio-capture': 'Le microphone est indisponible ou déjà utilisé par une autre application.',
          busy: 'Le service vocal est déjà occupé. Réessayez dans quelques secondes.',
        };
        setVoiceError(messages[event.error] ?? `La dictée a échoué (${event.error}). Réessayez.`);
      }),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [speechModule]);

  const toggle = async () => {
    if (!speechModule) {
      setVoiceError(Platform.OS === 'web'
        ? 'La dictée nécessite un navigateur compatible (Chrome ou Edge) et une connexion sécurisée.'
        : Platform.OS === 'ios'
          ? 'Cette version ne contient pas le module vocal. Installe la version iOS OPERIX reconstruite avec expo-speech-recognition (pas Expo Go), puis autorise le microphone.'
          : 'Cette version ne contient pas le module vocal. Installe l’APK OPERIX reconstruit avec expo-speech-recognition (pas Expo Go), puis autorise le microphone.');
      return;
    }
    if (listening) {
      speechModule.stop();
      return;
    }

    try {
      const perm = await speechModule.requestPermissionsAsync();
      if (!perm.granted) {
        setVoiceError('Autorisez le microphone et la reconnaissance vocale dans les réglages de votre appareil.');
        return;
      }
      if (!speechModule.isRecognitionAvailable()) {
        setVoiceError('Aucun service de reconnaissance vocale n’est installé ou disponible sur cet appareil.');
        return;
      }
      transcriptReceived.current = false;
      setVoiceError('');
      speechModule.start({ lang: 'fr-FR', interimResults: false, continuous: false, addsPunctuation: true });
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'La reconnaissance vocale n’a pas pu démarrer.');
    }
  };

  return (
    <>
      <Pressable
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
                  ? 'Activer la dictée vocale'
                  : Platform.OS === 'ios'
                    ? 'Module vocal absent — app iOS à actualiser'
                    : 'Module vocal absent — APK à actualiser'}
        </T>
      </Pressable>
      {voiceError ? <T variant="caption" accessibilityLiveRegion="polite" className="mt-1 text-red">{voiceError}</T> : null}
    </>
  );
}
