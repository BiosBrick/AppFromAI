import AsyncStorage from '@react-native-async-storage/async-storage';

function prefix(moduleId: string, key: string) {
  return `mod:${moduleId}:kv:${key}`;
}

export function createModuleStorage(moduleId: string) {
  const listIndexKey = `mod:${moduleId}:kv:index`;

  async function readIndex(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(listIndexKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeIndex(keys: string[]) {
    await AsyncStorage.setItem(listIndexKey, JSON.stringify(keys));
  }

  return {
    async save(key: string, value: unknown) {
      const full = prefix(moduleId, key);
      await AsyncStorage.setItem(full, JSON.stringify(value));
      const keys = await readIndex();
      if (!keys.includes(key)) {
        keys.push(key);
        await writeIndex(keys);
      }
    },
    async load(key: string) {
      const raw = await AsyncStorage.getItem(prefix(moduleId, key));
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    },
    async list() {
      return readIndex();
    },
    async delete(key: string) {
      await AsyncStorage.removeItem(prefix(moduleId, key));
      const keys = (await readIndex()).filter((k) => k !== key);
      await writeIndex(keys);
    },
  };
}
