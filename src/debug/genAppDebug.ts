/**
 * Log strutturati in Metro / Xcode / Android logcat con prefisso [GenApp] per copiare e incollare facilmente.
 *
 * Usa `console.log` (non `console.error`): in React Native `console.error` viene intercettato da LogBox
 * e mostra stack falsi / messaggio `null` anche per log diagnostici.
 */

const MAX_STRING = 6000;
/** Metro/Hermes a volte tronca o corrompe righe enormi. */
const LOG_CHUNK = 3000;

/** Evita che JSON.stringify vada in errore o produca output illeggibile (surrogati UTF-16, stringhe enormi). */
function sanitizeLogString(s: string, maxLen: number): string {
  const t = s.length > maxLen ? `${s.slice(0, maxLen)}\n… [troncato, totale ${s.length} caratteri]` : s;
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const lo = i + 1 < t.length ? t.charCodeAt(i + 1) : 0;
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        out += t[i] + t[i + 1];
        i++;
      } else {
        out += '\ufffd';
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out += '\ufffd';
    } else {
      out += t[i];
    }
  }
  return out;
}

function sanitizeDeep(value: unknown, depth = 0, visited?: WeakSet<object>): unknown {
  if (depth > 12) return '[MaxDepth]';
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return sanitizeLogString(value, MAX_STRING);
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'symbol') return String(value);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogString(String(value.message), 2000),
      stack: value.stack ? sanitizeLogString(value.stack, 4000) : undefined,
    };
  }
  if (Array.isArray(value)) {
    const v = visited ?? new WeakSet<object>();
    if (v.has(value)) return '[Circular]';
    v.add(value);
    const cap = 80;
    const arr = value.slice(0, cap).map((x) => sanitizeDeep(x, depth + 1, v));
    if (value.length > cap) {
      arr.push(`… [+${value.length - cap} elementi]`);
    }
    return arr;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const v = visited ?? new WeakSet<object>();
    if (v.has(o)) return '[Circular]';
    v.add(o);
    const next: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      next[k] = sanitizeDeep(o[k], depth + 1, v);
    }
    return next;
  }
  return String(value);
}

function safeSerialize(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(
      value,
      (_key, v) => {
        if (typeof v === 'bigint') return String(v);
        if (typeof v === 'symbol') return String(v);
        if (typeof v === 'function') return `[Function ${(v as { name?: string }).name || 'anonymous'}]`;
        if (v instanceof Error) {
          return {
            name: v.name,
            message: sanitizeLogString(String(v.message), 2000),
            stack: v.stack ? sanitizeLogString(v.stack, 4000) : undefined,
          };
        }
        if (v !== null && typeof v === 'object') {
          if (seen.has(v as object)) return '[Circular]';
          seen.add(v as object);
        }
        if (typeof v === 'string') return sanitizeLogString(v, MAX_STRING);
        return v;
      },
      2
    );
    if (json === undefined) return `"${String(value)}"`;
    return json;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    try {
      return JSON.stringify(
        { serializeFailed: true, reason: sanitizeLogString(m, 500) },
        null,
        2
      );
    } catch {
      return `{"serializeFailed":true,"reason":"(fallback)"}`;
    }
  }
}

function logGenAppChunked(label: string, text: string): void {
  const body = text.length > 0 ? text : '(vuoto)';
  if (body.length <= LOG_CHUNK) {
    console.log(`${label} ${body}`);
    return;
  }
  const parts = Math.ceil(body.length / LOG_CHUNK);
  for (let p = 0; p < parts; p++) {
    const slice = body.slice(p * LOG_CHUNK, (p + 1) * LOG_CHUNK);
    console.log(`${label} [${p + 1}/${parts}] ${slice}`);
  }
}

export function reportGenAppError(
  scope: string,
  error: unknown,
  details?: Record<string, unknown>
): void {
  try {
    const e = error as Error & { stack?: string };
    const message =
      e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : String(error ?? 'unknown');
    const stack =
      e && typeof e === 'object' && 'stack' in e && typeof (e as { stack: unknown }).stack === 'string'
        ? (e as { stack: string }).stack
        : undefined;
    const payload = sanitizeDeep({
      scope,
      message: sanitizeLogString(message, 4000),
      ...(stack ? { stack: sanitizeLogString(stack, 6000) } : {}),
      ...details,
    }) as Record<string, unknown>;

    logGenAppChunked('[GenApp]', safeSerialize(payload));
    if (stack) {
      logGenAppChunked(`[GenApp] ${scope} stack:`, sanitizeLogString(stack, 6000));
    }
  } catch (inner) {
    console.log('[GenApp] log interno fallito:', String(inner));
  }
}
