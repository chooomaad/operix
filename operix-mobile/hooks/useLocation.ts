import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

export function useCurrentLocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'error' | 'ok'>('idle');
  const pending = useRef<Promise<Fix | null> | null>(null);

  const locate = useCallback((): Promise<Fix | null> => {
    if (pending.current) return pending.current;
    setStatus('locating');
    const request = (async (): Promise<Fix | null> => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setStatus('denied');
          return null;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const currentFix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          capturedAt: new Date(pos.timestamp).toISOString(),
        };
        setFix(currentFix);
        setStatus('ok');
        return currentFix;
      } catch {
        setStatus('error');
        return null;
      }
    })();
    pending.current = request;
    void request.finally(() => {
      if (pending.current === request) pending.current = null;
    });
    return request;
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  return { fix, status, locate };
}
