import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

export function useCurrentLocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'error' | 'ok'>('idle');

  const locate = useCallback(async () => {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setFix({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        capturedAt: new Date(pos.timestamp).toISOString(),
      });
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  return { fix, status, locate };
}
