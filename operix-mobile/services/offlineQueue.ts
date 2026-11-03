import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { incidentsService, nearMissService, type NewIncident, type NewNearMiss } from './incidents';
import { isNetworkError, type LocalFile } from './api';

/**
 * File locale des déclarations faites sans réseau.
 *
 * Réelle synchronisation : l'API accepte une création différée (la position porte
 * sa propre date de capture, `location_captured_at`). La photo est copiée dans le
 * stockage de l'app pour survivre au nettoyage du cache de la caméra.
 * L'analyse IA, elle, exige le réseau : une déclaration hors-ligne part sans plan.
 */
const KEY = 'operix.offline-queue.v1';

export type QueuedItem =
  | { id: string; kind: 'incident'; payload: NewIncident; image: LocalFile | null; queuedAt: string }
  | { id: string; kind: 'near_miss'; payload: NewNearMiss; image: LocalFile | null; queuedAt: string };

type Listener = (items: QueuedItem[]) => void;
const listeners = new Set<Listener>();

async function read(): Promise<QueuedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedItem[]) : [];
  } catch {
    return [];
  }
}

async function write(items: QueuedItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l(items));
}

async function persistImage(image: LocalFile | null): Promise<LocalFile | null> {
  if (!image || !FileSystem.documentDirectory) return image;
  const target = `${FileSystem.documentDirectory}offline-${Date.now()}-${image.name}`;
  await FileSystem.copyAsync({ from: image.uri, to: target });
  return { ...image, uri: target };
}

let syncing = false;

export const offlineQueue = {
  list: read,

  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async enqueue(item: Omit<QueuedItem, 'id' | 'queuedAt'>): Promise<void> {
    const items = await read();
    const image = await persistImage(item.image);
    items.push({ ...item, image, id: `${Date.now()}`, queuedAt: new Date().toISOString() } as QueuedItem);
    await write(items);
  },

  /** Rejoue la file ; s'arrête au premier échec réseau, écarte les rejets définitifs (422). */
  async flush(): Promise<{ sent: number; remaining: number }> {
    if (syncing) return { sent: 0, remaining: (await read()).length };
    syncing = true;
    let sent = 0;
    try {
      let items = await read();
      for (const item of [...items]) {
        try {
          if (item.kind === 'incident') await incidentsService.create(item.payload, item.image);
          else await nearMissService.create(item.payload, item.image);
          sent++;
        } catch (e) {
          if (isNetworkError(e)) break;
          // Rejet métier : on ne bloque pas toute la file pour un élément invalide.
        }
        items = items.filter((i) => i.id !== item.id);
        await write(items);
        if (item.image) FileSystem.deleteAsync(item.image.uri, { idempotent: true }).catch(() => undefined);
      }
      return { sent, remaining: items.length };
    } finally {
      syncing = false;
    }
  },
};
