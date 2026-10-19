import axios, { AxiosError, isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, REQUEST_TIMEOUT_MS } from '@/constants/config';

const TOKEN_KEY = 'operix.token';

let memoryToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const tokenStore = {
  async load(): Promise<string | null> {
    memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
    return memoryToken;
  },
  async save(token: string): Promise<void> {
    memoryToken = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear(): Promise<void> {
    memoryToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
  current: (): string | null => memoryToken,
};

/** Branché par AuthProvider : un 401 ramène toujours à l'écran de connexion. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (memoryToken) config.headers.Authorization = `Bearer ${memoryToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && memoryToken) onUnauthorized?.();
    return Promise.reject(error);
  },
);

/** Vrai quand la requête n'a jamais atteint le serveur (hors-ligne, timeout). */
export function isNetworkError(e: unknown): boolean {
  return isAxiosError(e) && !e.response;
}

/** Message lisible pour l'utilisateur à partir d'une erreur API Laravel. */
export function errorMessage(e: unknown, fallback = 'Une erreur est survenue.'): string {
  if (isAxiosError(e)) {
    if (!e.response) return 'Connexion impossible au serveur OPERIX.';
    const data = e.response.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    return first ?? data?.message ?? fallback;
  }
  return fallback;
}

/** Fichier local (photo) au format attendu par FormData sous React Native. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

export function toFormData(fields: Record<string, string | number | null | undefined>, files: Record<string, LocalFile | null | undefined> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined && v !== '') fd.append(k, String(v));
  }
  for (const [k, f] of Object.entries(files)) {
    // React Native accepte { uri, name, type } comme Blob : le typage DOM l'ignore.
    if (f) fd.append(k, f as unknown as Blob);
  }
  return fd;
}

export const multipart = { headers: { 'Content-Type': 'multipart/form-data' } } as const;
