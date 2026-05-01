import type { MotherApi } from '../capabilities/types';
import { reportGenAppError } from '../debug/genAppDebug';
import { scanGeneratedCode } from '../security/codeScanner';

const DEFAULT_TIMEOUT_MS = 8_000;

/** Pulisce il sorgente del modulo prima di compilarlo. */
export function sanitizeModuleCodeSource(code: string): string {
  return code
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u200B/g, '')
    // Rimuove link Markdown che i modelli inseriscono nel code: [state.x](http://...) \u2192 state.x
    // Senza questo strip, stripJsComments elimina la parte dopo // rendendo il codice invalido.
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^)\n]+\)/g, '$1')
    .trim();
}

/**
 * Rimuove commenti JS (// e /* *\/) dal codice preservando le stringhe.
 * Questo è fondamentale: commenti con caratteri non-ASCII (es. italiano) possono
 * causare `invalid expression` in Hermes new Function.
 */
function stripJsComments(code: string): string {
  let result = '';
  let i = 0;
  let inStr = false;
  let strChar = '';
  let escaped = false;

  while (i < code.length) {
    const c = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (escaped) { result += c; escaped = false; i++; continue; }

    if (inStr) {
      result += c;
      if (c === '\\') escaped = true;
      else if (c === strChar) inStr = false;
      i++;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      inStr = true; strChar = c;
      result += c; i++;
      continue;
    }

    if (c === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n' && code[i] !== '\r') i++;
      continue;
    }

    if (c === '/' && next === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      if (i < code.length) i += 2;
      continue;
    }

    result += c;
    i++;
  }

  return result;
}

/**
 * Trasforma la sintassi shorthand async dei metodi in forma esplicita.
 * Hermes new Function può avere problemi con `async name(args) {` dentro object literal.
 * `async clear(api, input, state) {` → `clear: async function(api, input, state) {`
 */
function normalizeAsyncMethods(code: string): string {
  return code.replace(/\basync (?!function\b)(\w+)\s*\(/g, '$1: async function(');
}

/**
 * Hermes non accetta TypeScript. Rimuove annotazioni di tipo sicure,
 * evitando di toccare valori JS validi come `null`, `undefined`, `void 0`.
 */
function stripTypescriptNoiseFromJs(code: string): string {
  let s = code;

  const typePatterns: RegExp[] = [
    /:\s*MotherApi\b/g,
    /:\s*ModuleAction\b/g,
    /:\s*CompiledActions\b/g,
    /:\s*any\b/g,
    /:\s*unknown\b/g,
    /:\s*object\b/g,
    /:\s*Record\s*<\s*string\s*,\s*unknown\s*>/g,
    /:\s*Record\s*<\s*string\s*,\s*any\s*>/g,
    /:\s*Record\s*<\s*string\s*,\s*string\s*>/g,
    /:\s*Promise\s*<\s*[^>]+\s*>/g,
    /:\s*React\.\w+/g,
  ];

  for (const re of typePatterns) {
    s = s.replace(re, '');
  }

  // Rimuove `: string|number|boolean` solo nel contesto di parametri di funzione
  // (preceduti da `(` o `,`), non in object literals dove sarebbero valori JS.
  s = s.replace(/([,(]\s*\w+)\s*:\s*(string|number|boolean)\b/g, '$1');

  // Rimuove return type annotation su metodi/funzioni: `method(...): void {` → `method(...) {`
  s = s.replace(/\)\s*:\s*(void|string|number|boolean)\s*\{/g, ') {');
  s = s.replace(/\)\s*:\s*Promise\s*<\s*[^>]+\s*>\s*\{/g, ') {');

  s = s.replace(/\s+as\s+const\b/g, '');
  s = s.replace(/\s+as\s+[\w.$\[\]<>|&]+\b/g, '');

  return s;
}

/** Decodifica un livello se la AI ha wrappato il code come stringa JSON. */
function unwrapJsonEncodedCodeString(code: string): string {
  const t = code.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    try {
      const inner = JSON.parse(t) as unknown;
      if (typeof inner === 'string' && inner !== t) {
        return unwrapJsonEncodedCodeString(inner);
      }
    } catch {
      /* ignora */
    }
  }
  return code;
}

/**
 * Conta le graffe aperte non chiuse nel sorgente JS,
 * ignorando stringhe e commenti.
 */
function countUnclosedBraces(code: string): number {
  let depth = 0;
  let inStr = false;
  let inLineComment = false;
  let inBlockComment = false;
  let strChar = '';
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === strChar) inStr = false;
      continue;
    }

    if (c === '/' && next === '/') { inLineComment = true; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; continue; }
    if (c === '"' || c === "'" || c === '`') {
      inStr = true;
      strChar = c;
      continue;
    }

    if (c === '{') depth++;
    if (c === '}') depth--;
  }

  return depth;
}

/** Passaggio finale prima di `new Function`. */
export function finalizeModuleCodeForVm(code: string): string {
  let s = sanitizeModuleCodeSource(code);
  s = unwrapJsonEncodedCodeString(s);
  s = stripTypescriptNoiseFromJs(s);
  s = stripJsComments(s);
  s = normalizeAsyncMethods(s);
  return sanitizeModuleCodeSource(s);
}

/**
 * Genera candidati da provare in compilazione.
 * Usa il conteggio reale delle graffe per aggiungere esattamente le chiusure mancanti.
 */
function buildModuleCodeCandidates(raw: string): string[] {
  const c = finalizeModuleCodeForVm(raw);
  const add = (arr: string[], s: string) => {
    const t = s.trim();
    if (t && !arr.includes(t)) arr.push(t);
  };

  const needsExportWrapper =
    !/module\s*\.\s*exports/.test(c) && /^\s*\{/.test(c) && /\bactions\s*:/.test(c);

  const bases = needsExportWrapper
    ? [`module.exports = ${c}`, `module.exports = ${c};`, c]
    : [c];

  const out: string[] = [];
  for (const b of bases) {
    add(out, b);
    if (!b.trim().endsWith(';')) add(out, `${b};`);

    const missing = countUnclosedBraces(b);
    if (missing > 0) {
      // Strip trailing `;` before inserting closers so `};` becomes `}};` not `};}`.
      const endsWithSemi = /;\s*$/.test(b);
      const stem = endsWithSemi ? b.replace(/;\s*$/, '') : b;
      for (let n = missing; n <= Math.min(missing + 3, 8); n++) {
        const closers = '}'.repeat(n);
        add(out, `${stem}${closers}`);
        add(out, `${stem}${closers};`);
      }
    } else if (missing < 0) {
      // Graffe di chiusura in eccesso in coda (errore frequente nei modelli): prova a toglierne qualcuna.
      const withoutSemi = b.trimEnd().replace(/;\s*$/, '');
      for (let k = -missing; k <= Math.min(-missing + 4, 10); k++) {
        let stem = withoutSemi;
        for (let i = 0; i < k; i++) {
          if (!/\}\s*$/.test(stem)) break;
          stem = stem.replace(/\}\s*$/, '').trimEnd();
        }
        add(out, stem);
        add(out, `${stem};`);
      }
    }
  }

  return out.slice(0, 32);
}

export type CompiledActions = Record<
  string,
  (api: MotherApi, input: Record<string, unknown>, state: Record<string, unknown>) => Promise<unknown>
>;

function assertSerializable(value: unknown): void {
  try {
    JSON.stringify(value);
  } catch (e) {
    throw new Error(`Valore di ritorno non serializzabile: ${(e as Error).message}`);
  }
}

export function compileModuleActions(code: string): CompiledActions {
  const codeClean = finalizeModuleCodeForVm(code);
  const scan = scanGeneratedCode(codeClean);
  if (!scan.ok) {
    throw new Error(scan.reason);
  }

  const module: { exports?: unknown } = {};
  module.exports = {};
  let factory: (m: { exports?: unknown }, e: unknown) => void;
  try {
    factory = new Function('module', 'exports', codeClean) as (m: { exports?: unknown }, e: unknown) => void;
  } catch (e) {
    const err = e as Error;
    const msg = err.message || String(e);
    const hint =
      /invalid expression|unexpected|virgolette|expected/i.test(msg) || e instanceof SyntaxError
        ? ' Suggerimento: niente TypeScript nei parametri; virgolette nel `code` devono essere escape nel JSON della risposta. Graffe e parentesi bilanciate.'
        : '';
    throw new Error(
      `JavaScript del modulo non valido (errore in compilazione): ${msg}.${hint}`
    );
  }
  try {
    factory(module, module.exports);
  } catch (e) {
    const err = e as Error;
    throw new Error(
      `Esecuzione iniziale del modulo fallita: ${err.message}. Spesso manca una graffa o c'è una virgola di troppo.`
    );
  }

  const root = module.exports as { actions?: CompiledActions };
  const actions = root?.actions;

  if (!actions || typeof actions !== 'object') {
    throw new Error('Il modulo deve definire actions (module.exports = { actions: { ... } }).');
  }

  for (const key of Object.keys(actions)) {
    const fn = actions[key];
    if (typeof fn !== 'function') {
      throw new Error(`Action "${key}" non è una funzione`);
    }
  }

  return actions;
}

export type CompileModuleResult =
  | { ok: true; actions: CompiledActions }
  | { ok: false; error: string };

function formatRuntimeActionError(e: unknown): Error {
  const err = e as Error;
  const msg = err.message || String(e);
  const missingProp = msg.match(/Property '([^']+)' doesn't exist/);
  if (missingProp) {
    return new Error(
      `Variabile non dichiarata nel codice del modulo: "${missingProp[1]}". ` +
        'Di solito succede quando il modello usa una variabile prima di crearla, oppure dichiara const/let dentro un if e poi la usa fuori. Rigenera il modulo.'
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

/** Come compileModuleActions ma non lancia: per UI (DynamicRenderer). */
export function tryCompileModuleActions(code: string): CompileModuleResult {
  const candidates = buildModuleCodeCandidates(code);
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return { ok: true, actions: compileModuleActions(candidate) };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  const base = errors[0] ?? 'Compilazione fallita';
  const finalized = finalizeModuleCodeForVm(code);
  const unclosed = countUnclosedBraces(finalized);
  const hint =
    unclosed > 0
      ? ` (graffe non bilanciate: ${unclosed} aperta/e). Rigenerare il modulo; nel prompt specificare code con module.exports = { actions: { ... } }; ben chiuso.`
      : ` Rigenerare il modulo con un prompt più preciso.`;
  reportGenAppError('moduleCompile.failed', new Error(base + hint), {
    attempts: candidates.length,
    allMessages: errors,
    unclosedBraces: unclosed,
    originalCodeLength: code.length,
    finalizedHead: finalized.slice(0, 1800),
    finalizedTail: finalized.slice(Math.max(0, finalized.length - 600)),
  });
  return { ok: false, error: base + hint };
}

export async function runAction(
  actions: CompiledActions,
  name: string,
  api: MotherApi,
  input: Record<string, unknown>,
  state: Record<string, unknown>,
  options?: { timeoutMs?: number }
): Promise<Record<string, unknown>> {
  const fn = actions[name];
  if (!fn) {
    throw new Error(`Action sconosciuta: ${name}`);
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const run = async () => {
    const result = await fn(api, input, state);
    if (result !== undefined && result !== null && typeof result !== 'object') {
      throw new Error('Ogni action deve restituire un oggetto o null/undefined');
    }
    const obj = (result ?? {}) as Record<string, unknown>;
    assertSerializable(obj);
    return obj;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout azione (${timeoutMs}ms)`)), timeoutMs);
      }),
    ]);
  } catch (e) {
    const formatted = formatRuntimeActionError(e);
    reportGenAppError('moduleRunner.runAction', formatted, { action: name, originalMessage: (e as Error)?.message });
    throw formatted;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
