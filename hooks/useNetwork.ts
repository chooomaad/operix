import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        setOnline(Boolean(s.isConnected) && s.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
