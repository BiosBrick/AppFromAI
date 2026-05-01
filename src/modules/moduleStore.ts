import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredModule } from '../types/generatedModule';
import { reportGenAppError } from '../debug/genAppDebug';
import { validateGeneratedModule, toStoredModule } from './moduleValidator';
import { STORAGE_KEY } from './moduleTypes';

async function readAll(): Promise<StoredModule[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as StoredModule[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(modules: StoredModule[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
}

export async function listModules(): Promise<StoredModule[]> {
  return readAll();
}

export async function getModule(id: string): Promise<StoredModule | null> {
  const all = await readAll();
  return all.find((m) => m.id === id) ?? null;
}

export async function saveModule(
  payload: unknown,
  prompt?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateGeneratedModule(payload);
  if (!v.ok) return { ok: false, error: v.error };
  const stored = toStoredModule(v.module, prompt);
  const all = await readAll();
  const idx = all.findIndex((m) => m.id === stored.id);
  if (idx >= 0) {
    all[idx] = stored;
  } else {
    all.push(stored);
  }
  await writeAll(all);
  return { ok: true };
}

export async function deleteModule(id: string): Promise<void> {
  const all = (await readAll()).filter((m) => m.id !== id);
  await writeAll(all);
}

export async function upsertFromRawJson(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    const msg = `JSON non valido: ${(e as Error).message}`;
    reportGenAppError('moduleStore.upsertJsonParse', e, { jsonHead: json.slice(0, 400) });
    return { ok: false, error: msg };
  }
  return saveModule(data);
}
