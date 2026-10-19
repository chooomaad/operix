import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '@/services/auth';
import { isNetworkError, setUnauthorizedHandler, tokenStore } from '@/services/api';
import { clearQueryCache } from '@/hooks/useQuery';
import type { Session } from '@/types/api';

const SESSION_KEY = 'operix.session';
const BIOMETRIC_KEY = 'operix.biometric';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  can: (ability: string) => boolean;
  login: (matricule: string, pin: string) => Promise<void>;
  /** Déverrouille la session déjà stockée (le jeton reste dans SecureStore). */
  biometricLogin: () => Promise<boolean>;
  biometricAvailable: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const signOutLocal = useCallback(async () => {
    await tokenStore.clear();
    await SecureStore.deleteItemAsync(SESSION_KEY);
    clearQueryCache();
    setSession(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOutLocal());
    return () => setUnauthorizedHandler(null);
  }, [signOutLocal]);

  // Restauration : la session en cache permet un démarrage hors-ligne,
  // /auth/me la rafraîchit (et révèle un jeton révoqué) dès que le réseau répond.
  useEffect(() => {
    void (async () => {
      const [hasHw, enrolled, bioFlag] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]);
      const token = await tokenStore.load();
      setBiometricAvailable(hasHw && enrolled && bioFlag === '1' && Boolean(token));

      if (!token) {
        setStatus('signedOut');
        return;
      }
      // Biométrie activée : on attend le déverrouillage sur l'écran de connexion.
      if (bioFlag === '1' && hasHw && enrolled) {
        setStatus('signedOut');
        return;
      }
      await restore();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restore = useCallback(async () => {
    const cached = await SecureStore.getItemAsync(SESSION_KEY);
    if (cached) {
      setSession(JSON.parse(cached) as Session);
      setStatus('signedIn');
    }
    try {
      const fresh = await authService.me();
      setSession(fresh);
      setStatus('signedIn');
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(fresh));
    } catch (e) {
      if (!isNetworkError(e) || !cached) await signOutLocal();
    }
  }, [signOutLocal]);

  const login = useCallback(async (matricule: string, pin: string) => {
    const s = await authService.login(matricule, pin);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s));
    const [hasHw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    if (hasHw && enrolled) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, '1');
      setBiometricAvailable(true);
    }
    setSession(s);
    setStatus('signedIn');
  }, []);

  const biometricLogin = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Connexion OPERIX', cancelLabel: 'Annuler' });
    if (!res.success) return false;
    await restore();
    return true;
  }, [restore]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Hors-ligne : le jeton local est quand même détruit.
    }
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    setBiometricAvailable(false);
    await signOutLocal();
  }, [signOutLocal]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      can: (a) => session?.abilities.includes(a) ?? false,
      login,
      biometricLogin,
      biometricAvailable,
      logout,
    }),
    [status, session, login, biometricLogin, biometricAvailable, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
