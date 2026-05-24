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
      console.log(`[Storage] save — moduleId: ${moduleId}, key: ${key}, value:`, JSON.stringify(value).slice(0, 200));
      await AsyncStorage.setItem(full, JSON.stringify(value));
      const keys = await readIndex();
      if (!keys.includes(key)) {
        keys.push(key);
        await writeIndex(keys);
      }
    },
    async load(key: string) {
      const raw = await AsyncStorage.getItem(prefix(moduleId, key));
      console.log(`[Storage] load — moduleId: ${moduleId}, key: ${key}, raw:`, raw?.slice(0, 200) ?? 'null');
      if (raw == null) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return raw;
      }
      // Compatibilità con il pattern doppio-encoding (JSON.stringify prima di save):
      // se il valore parsato è ancora una stringa JSON (array/oggetto), la parsiamo una volta in più
      // così il codice generato riceve sempre il valore finale, indipendentemente da come l'ha salvato.
      if (typeof parsed === 'string') {
        const t = parsed.trim();
        if (t.startsWith('[') || t.startsWith('{')) {
          try {
            const unwrapped = JSON.parse(t);
            console.log(`[Storage] load — double-encoding detected, unwrapped:`, JSON.stringify(unwrapped).slice(0, 200));
            return unwrapped;
          } catch { /* stringa che inizia con [ o { ma non è JSON */ }
        }
      }
      console.log(`[Storage] load — risultato finale:`, JSON.stringify(parsed).slice(0, 200));
      return parsed;
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
