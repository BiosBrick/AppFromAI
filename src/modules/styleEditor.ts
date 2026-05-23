const TEXT_KEYS = new Set(['text', 'label', 'title', 'placeholder', 'hint', 'caption']);
const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?$/;

export type ColorEntry = { original: string; count: number };
export type TextEntry = { pathKey: string; path: string[]; value: string };

export function extractColors(ui: unknown): ColorEntry[] {
  const map = new Map<string, number>();

  // Check any string value anywhere in the JSON — theme uses keys like
  // bg/surface/primary/muted which aren't in a predefined set, so we match
  // by value shape (hex) rather than by key name.
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    for (const [, val] of Object.entries(node as Record<string, unknown>)) {
      if (typeof val === 'string' && HEX_RE.test(val)) {
        const lo = val.toLowerCase();
        map.set(lo, (map.get(lo) ?? 0) + 1);
      } else {
        walk(val);
      }
    }
  }

  walk(ui);
  return [...map.entries()]
    .map(([original, count]) => ({ original, count }))
    .sort((a, b) => b.count - a.count);
}

export function extractTexts(ui: unknown): TextEntry[] {
  const results: TextEntry[] = [];

  function walk(node: unknown, path: string[]) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, [...path, String(i)]));
      return;
    }
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (
        TEXT_KEYS.has(key) &&
        typeof val === 'string' &&
        val.trim().length >= 2 &&
        !HEX_RE.test(val) &&
        !val.startsWith('http') &&
        !/^[a-z_]+$/.test(val)
      ) {
        const pathArr = [...path, key];
        results.push({ pathKey: pathArr.join('.'), path: pathArr, value: val });
      } else {
        walk(val, [...path, key]);
      }
    }
  }

  walk(ui, []);
  return results;
}

export function applyColorChanges(ui: unknown, changes: Map<string, string>): unknown {
  if (changes.size === 0) return ui;
  let json = JSON.stringify(ui);
  for (const [from, to] of changes.entries()) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    json = json.replace(new RegExp(escaped, 'gi'), to);
  }
  return JSON.parse(json);
}

export function applyTextChanges(ui: unknown, changes: Map<string, string>): unknown {
  if (changes.size === 0) return ui;
  const clone: Record<string, unknown> = JSON.parse(JSON.stringify(ui));

  for (const [pathKey, newValue] of changes.entries()) {
    const path = pathKey.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = clone;
    for (let i = 0; i < path.length - 1; i++) {
      if (node == null) break;
      const seg = path[i];
      node = Array.isArray(node) ? node[parseInt(seg, 10)] : node[seg];
    }
    if (node != null) {
      const last = path[path.length - 1];
      if (Array.isArray(node)) node[parseInt(last, 10)] = newValue;
      else node[last] = newValue;
    }
  }

  return clone;
}

export function isValidHex(s: string): boolean {
  return HEX_RE.test(s);
}

export const PALETTE: string[] = [
  '#0b1120', '#111827', '#1e293b', '#27272a', '#292524', '#1c1917',
  '#334155', '#4b5563', '#6b7280', '#78716c', '#9ca3af', '#cbd5e1',
  '#f1f5f9', '#f8fafc', '#ffffff', '#fef9c3', '#fce7f3', '#e0f2fe',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
];
