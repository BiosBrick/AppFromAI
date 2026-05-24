import { File, Directory, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INDEX_PREFIX = 'genapp_file_index::';

function moduleDir(moduleId: string): Directory {
  return new Directory(Paths.document, 'genapp_files', moduleId);
}

function destFile(moduleId: string, key: string, ext: string): File {
  const safe = key.replace(/[^a-z0-9_-]/gi, '_');
  return new File(moduleDir(moduleId), safe + '.' + ext);
}

async function getIndex(indexKey: string): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(indexKey);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

async function setIndex(indexKey: string, idx: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(indexKey, JSON.stringify(idx));
}

export function createFileStorageCapability(moduleId: string) {
  const indexKey = INDEX_PREFIX + moduleId;

  return {
    async save(key: string, sourceUri: string): Promise<{ uri: string }> {
      if (sourceUri.startsWith('data:image/')) {
        const match = sourceUri.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/);
        if (!match) throw new Error('Data URI immagine non valido');
        const [, rawExt, base64] = match;
        const dir = moduleDir(moduleId);
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
        const dest = destFile(moduleId, key, ext);
        dest.write(base64, { encoding: 'base64' });

        const idx = await getIndex(indexKey);
        idx[key] = dest.uri;
        await setIndex(indexKey, idx);
        return { uri: dest.uri };
      }

      const dir = moduleDir(moduleId);
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

      const ext = sourceUri.split('?')[0].split('.').pop() ?? 'bin';
      const dest = destFile(moduleId, key, ext);

      const src = new File(sourceUri);
      src.copy(dest);

      const idx = await getIndex(indexKey);
      idx[key] = dest.uri;
      await setIndex(indexKey, idx);
      return { uri: dest.uri };
    },

    async load(key: string): Promise<string | null> {
      const idx = await getIndex(indexKey);
      const uri = idx[key];
      if (!uri) return null;
      const f = new File(uri);
      return f.exists ? uri : null;
    },

    async delete(key: string): Promise<void> {
      const idx = await getIndex(indexKey);
      const uri = idx[key];
      if (uri) {
        const f = new File(uri);
        if (f.exists) f.delete();
      }
      delete idx[key];
      await setIndex(indexKey, idx);
    },

    async list(): Promise<string[]> {
      const idx = await getIndex(indexKey);
      return Object.keys(idx);
    },
  };
}
