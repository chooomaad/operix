import Constants from 'expo-constants';

const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

/** URL de base de operix-api, préfixe /api/v1 inclus. */
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? fromExtra ?? '').replace(/\/$/, '');

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Délai réseau : le terrain a souvent une 4G instable, on échoue vite pour basculer hors-ligne. */
export const REQUEST_TIMEOUT_MS = 20_000;
