import axios from 'axios';
import { buildModuleGenerationPrompt, getJsonResponseRetryHint } from './modulePromptExternal';
import { buildSmallModelPrompt, buildGemma4UiPass, buildGemma4CodePass, buildFinetunedPrompt } from './modulePromptLocal';
import { detectBuiltinGame, BUILTIN_GAMES } from './builtinGameTemplates';
import { pickMockModule } from './mockModules';
import type { GeneratedModulePayload } from '../types/generatedModule';
import { reportGenAppError } from '../debug/genAppDebug';
import { validateGeneratedModule } from '../modules/moduleValidator';
import { LocalLlmModule } from '../native/LocalLlmModule';

export type AiClientOptions = {
  /** Se true, nessuna chiamata HTTP: solo mock euristici su keyword. */
  useMock: boolean;
  /** Lingua UI da usare nei moduli generati (es. 'it', 'en', 'es'). Default 'it'. */
  language?: string;
  /**
   * Se useMock è false e `ollamaBaseUrl` è valorizzato → usa Ollama `/api/chat`.
   * Altrimenti usa Claude Messages API oppure OpenAI-compatible (chat completions).
   */
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  /** URL endpoint OpenAI-compatible (es. https://api.openai.com/v1/chat/completions). */
  apiUrl?: string;
  apiKey?: string;
  apiModel?: string;
  apiProvider?: 'openai' | 'claude';
  apiMaxTokens?: number;
  apiExtraBody?: Record<string, unknown>;
  claudeBaseUrl?: string;
  claudeApiKey?: string;
  claudeModel?: string;
  /** Use on-device LiteRT-LM inference (Android only). */
  useLocalProvider?: boolean;
  /** Model id to load before inference (auto-loads if not already in memory). */
  localModelId?: string;
};

type HttpResponseLike = {
  status: number;
  data: unknown;
};

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

function extractFirstJsonObject(text: string): string {
  const t = stripJsonFences(text);
  const start = t.indexOf('{');
  if (start === -1) return t;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let q = '';
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === q) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      q = c;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }
  return t.slice(start);
}

function parseStrictJson(text: string): unknown {
  const cleaned = sanitizeJsonControlChars(stripJsonFences(text));
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(extractFirstJsonObject(cleaned));
  }
}

/**
 * Escape literal control characters (U+0000–U+001F) that appear inside JSON
 * string values in model output. JSON.parse rejects them; this pre-pass makes
 * the string valid before parsing or repair.
 */
function sanitizeJsonControlChars(text: string): string {
  let result = '';
  let inString = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const code = text.charCodeAt(i);
    if (esc) { result += c; esc = false; continue; }
    if (inString) {
      if (c === '\\') { result += c; esc = true; continue; }
      if (c === '"') { inString = false; result += c; continue; }
      if (code < 0x20) {
        if (code === 0x09) result += '\\t';
        else if (code === 0x0A) result += '\\n';
        else if (code === 0x0D) result += '\\r';
        else result += `\\u${code.toString(16).padStart(4, '0')}`;
        continue;
      }
    } else if (c === '"') {
      inString = true;
    }
    result += c;
  }
  return result;
}

function stripGemma4Tokens(content: string): string {
  // Truncate at the first turn boundary token (end_of_turn or start_of_turn).
  // The model sometimes echoes <start_of_turn> mid-output and then repeats a
  // second version of the code — anything after the token is junk that corrupts JS/JSON.
  const boundary = content.search(/<\/?(?:end|start)_of_turn>/);
  if (boundary !== -1) content = content.slice(0, boundary);
  return content
    .replace(/<tool_call\|>/g, '')
    .replace(/<tool_response\|>/g, '')
    .trim();
}

/**
 * Best-effort repair for JSON emitted by small local models.
 * Handles: unquoted keys, wrong bracket type, trailing commas,
 * and unclosed brackets at end of truncated output.
 */
function repairLocalModelJson(raw: string): string {
  // Pre-step: fix "key:"value → "key":"value BEFORE extractFirstJsonObject.
  // The model sometimes emits "text:"Score: 0" (closing quote of key before colon, value unquoted).
  // This confuses the string tracker in extractFirstJsonObject: it thinks everything after the second
  // quote is inside a string, so the outer } is never seen, and extractFirstJsonObject returns the
  // full raw including trailing junk (e.g. \n]}). sanitizeJsonControlChars then escapes the real
  // newline to \\n, causing "Unexpected character: \" at parse time.
  // Fix this in the raw string BEFORE any extraction so all subsequent steps see well-formed keys.
  // Case A: "key:"stringValue  →  "key":"stringValue  (closing quote landed before colon)
  let rawFixed = raw.replace(/"([a-zA-Z_][a-zA-Z0-9_]*):"([^"\s,}\]])/g, '"$1":"$2');
  // Case B: "key:true/"key:false/"key:null/"key:number  →  "key":value  (colon swallowed into key, bare value)
  rawFixed = rawFixed.replace(/"([a-zA-Z_][a-zA-Z0-9_]*):(true|false|null|-?\d+(?:\.\d+)?)(?=[,}\]\s])/g, '"$1":$2');

  // Step 0: extract the first JSON object from the raw output.
  let text = extractFirstJsonObject(rawFixed);

  // Step 0b: pre-fix keys with missing opening quote BEFORE sanitizeJsonControlChars.
  // Model emits: ,key":"value"  (spurious " before the colon, no opening " on the key).
  // If we call sanitizeJsonControlChars first with this malformed text, the " after the key
  // enters "string mode" and any newline in the structural JSON after it gets escaped to
  // a literal \n, producing SyntaxError: Unexpected character: \.
  // Fix: add the missing opening quote so the string tracker sees a well-formed key.
  // Pattern: {/,  identifier  "  optional-spaces  :  → {/,  "identifier"  :
  text = text.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)"(\s*:)/g, '$1"$2"$3');

  // Step 1: escape literal control characters inside JSON string values.
  // Now that keys are well-formed the string tracker works correctly.
  text = sanitizeJsonControlChars(text);

  // Step 2: remove trailing commas before ] or } (rare in code strings, safe to apply globally)
  text = text.replace(/,(\s*[}\]])/g, '$1');

  // Step 2b: fix malformed key quotes — model emits "key:"value" instead of "key":"value".
  // Insert the missing closing quote: "key:" → "key":".
  // Safe: [a-zA-Z_][a-zA-Z0-9_]* only matches identifier-like keys; the colon must come
  // directly after the identifier (no closing " first), so correct "key":"value" is never matched.
  text = text.replace(/"([a-zA-Z_][a-zA-Z0-9_]*):"([^"\s,}\]])/g, '"$1":"$2');

  // Step 3: fix unquoted keys ONLY outside JSON string literals.
  // Applying the regex to the whole text would mangle the "code" field value
  // (e.g. `{actions:` inside the JS code string becomes `{"actions":` which splits the
  // surrounding JSON string at the inserted `"`).
  {
    const parts: string[] = [];
    let inStr = false;
    let esc = false;
    let segStart = 0;
    const keyRe = /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g;
    const fixKeys = (s: string) =>
      s.replace(keyRe, (_, prefix, key) => `${prefix}"${key}":`);

    for (let i = 0; i < text.length; i++) {
      if (esc) { esc = false; continue; }
      if (inStr) {
        if (text[i] === '\\') { esc = true; continue; }
        if (text[i] === '"') {
          inStr = false;
          parts.push(text.slice(segStart, i + 1)); // string token — push as-is
          segStart = i + 1;
        }
        continue;
      }
      if (text[i] === '"') {
        parts.push(fixKeys(text.slice(segStart, i))); // non-string segment — fix keys
        inStr = true;
        segStart = i; // opening " is part of the string token
      }
    }
    // flush remainder
    const tail = text.slice(segStart);
    parts.push(inStr ? tail : fixKeys(tail));
    text = parts.join('');
  }

  // Step 3b: fix unquoted string values ONLY outside JSON string literals.
  // Handles: "key":identifier → "key":"identifier" (excludes true/false/null/numbers).
  // This catches patterns like "type":input or "direction":row from small models.
  {
    const parts: string[] = [];
    let inStr = false;
    let esc = false;
    let segStart = 0;
    const valRe = /:\s*([a-zA-Z_][a-zA-Z0-9_.-]*)(?=\s*[,}\]])/g;
    const fixVals = (s: string) =>
      s.replace(valRe, (_, val) =>
        val === 'true' || val === 'false' || val === 'null' ? `: ${val}` : `:"${val}"`
      );
    for (let i = 0; i < text.length; i++) {
      if (esc) { esc = false; continue; }
      if (inStr) {
        if (text[i] === '\\') { esc = true; continue; }
        if (text[i] === '"') {
          inStr = false;
          parts.push(text.slice(segStart, i + 1));
          segStart = i + 1;
        }
        continue;
      }
      if (text[i] === '"') {
        parts.push(fixVals(text.slice(segStart, i)));
        inStr = true;
        segStart = i;
      }
    }
    const tail = text.slice(segStart);
    parts.push(inStr ? tail : fixVals(tail));
    text = parts.join('');
  }

  // Step 4: stack-based bracket balancer
  // Fixes: } used to close an open [, ] used to close an open {, unclosed brackets.
  {
    const out: string[] = [];
    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (const c of text) {
      if (esc) { out.push(c); esc = false; continue; }
      if (inStr) {
        out.push(c);
        if (c === '\\') { esc = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; out.push(c); continue; }
      if (c === '{' || c === '[') { stack.push(c); out.push(c); continue; }
      if (c === '}') {
        while (stack.length && stack[stack.length - 1] === '[') { out.push(']'); stack.pop(); }
        if (stack.length && stack[stack.length - 1] === '{') stack.pop();
        out.push(c);
        continue;
      }
      if (c === ']') {
        if (stack.length && stack[stack.length - 1] === '[') { stack.pop(); out.push(c); }
        else if (stack.length && stack[stack.length - 1] === '{') { stack.pop(); out.push('}'); }
        else out.push(c);
        continue;
      }
      out.push(c);
    }
    while (stack.length) { out.push(stack.pop() === '[' ? ']' : '}'); }
    text = out.join('');
  }

  return text;
}

function normalizeOllamaBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function joinUrl(base: string, path: string): string {
  return `${base.trim().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function buildRetryPrompt(userPrompt: string, reason: string, previousContent: string): string {
  const compileHint = /compil|javascript|graffe|syntax|declaration|unexpected/i.test(reason)
    ? `
ERRORE DI COMPILAZIONE — riscrivi completamente "code" in JavaScript semplice:
- Forma esatta: module.exports = { actions: { onTick(api, input, state) { ... return {...}; }, onTap(api, input, state) { ... return {...}; } } };
- Ogni action è una proprietà sorella dentro actions, separata da virgola.
- Non mettere onTap dentro onTick o dopo codice non chiuso.
- Ogni action deve avere un return raggiungibile.
- Se la logica è complessa, SEMPLIFICA il gioco invece di produrre codice lungo.
`
    : '';

  const truncationHint = /unexpected end|troncato|truncat|json non valido|json parse/i.test(reason)
    ? `
ERRORE DI TRONCAMENTO — il tuo codice precedente era TROPPO LUNGO e il JSON è stato tagliato a metà.
SOLUZIONE OBBLIGATORIA: scrivi onTick in massimo 8-10 righe usando Math.min/Math.max per i bounds.
NON usare if chains ripetuti. Esempio corretto per un gioco bounce (TUTTO onTick in una riga):
onTick(api,input,state){const W=320,H=420,R=10,G=0.5;const x=parseFloat(String(state.x??'160'));const y=parseFloat(String(state.y??'80'));const vx=parseFloat(String(state.vx??'3'));const vy=parseFloat(String(state.vy??'3'));const nx=x+vx;const ny=y+vy+G;const nvx=(nx<R||nx>W-R)?-vx:vx;const nvy=(ny<R)?-vy:(ny>H-R)?-Math.abs(vy)*0.8:vy+G;return{x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),vx:nvx,vy:nvy,scene:[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},{type:'circle',x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),r:R,color:'#6cf'}]};}
Questo è il MASSIMO livello di complessità consentito per onTick.
`
    : '';

  const runtimeHint = /Property '[^']+' doesn't exist|variabile non dichiarata|ReferenceError/i.test(reason)
    ? `
ERRORE RUNTIME — variabile non dichiarata o fuori scope:
- Dichiara ogni variabile con const/let prima di usarla.
- Nei giochi: calcola newX, newY, nvx, nvy, scene in cima all'action poi ritorna il patch.
- Non usare mai [state.foo](http://...) — scrivi solo state.foo senza parentesi quadre né URL.
- In onTap dichiara: const jump = -8; return { vy: jump };
`
    : '';

  return `Devi rigenerare da zero un modulo AppFromAI valido per questa richiesta:
${userPrompt.trim()}

La risposta precedente non era valida:
${reason}
${compileHint}${truncationHint}${runtimeHint}
Rispondi SOLO con un oggetto JSON valido. Nessun markdown, nessun testo extra.
La radice deve avere ESATTAMENTE queste chiavi: "manifest", "ui", "code".

Schema obbligatorio:
{"manifest":{"id":"id-minuscolo","name":"Nome","version":"1.0.0","runtime":"javascript","permissions":[],"entry":"logic.js","ui":"ui.json"},"ui":{"type":"screen","title":"Nome","components":[{"type":"gameView","id":"game","bind":"scene","width":320,"height":420,"tickMs":60,"tickAction":"onTick","onTapAction":"onTap"}]},"code":"module.exports={actions:{onTick(api,input,state){return{scene:[]};},onTap(api,input,state){return{};}}};"  }

Regole critiche per gameView:
- onTick MAX 10 righe. Usa Math.min/Math.max per bounds, MAI if chains ripetuti.
- Non usare mai link Markdown nel code: scrivi state.x non [state.x](http://state.x).
- Le action sono sorelle dentro actions separate da virgola.
- Il code è UNA stringa JSON (tutti i \\n e \\" escaped se necessario).

Inizio risposta precedente:
${previousContent.slice(0, 400)}

Fine risposta precedente:
${previousContent.slice(Math.max(0, previousContent.length - 300))}`;
}

/**
 * When the local model outputs multiple separate JSON screen objects instead of
 * a single navigator, try to collect them and wrap in a navigator automatically.
 * Returns a repaired navigator object, or null if the raw text does not look
 * like a list of screens.
 */
function tryWrapMultipleScreensAsNavigator(raw: string): unknown | null {
  const screens: Record<string, Record<string, unknown>> = {};
  let remaining = raw.trim();
  let count = 0;

  while (remaining.length > 0 && remaining.startsWith('{')) {
    const chunk = extractFirstJsonObject(remaining);
    let parsed: unknown;
    try {
      parsed = JSON.parse(repairLocalModelJson(chunk));
    } catch {
      break;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) break;
    const node = parsed as Record<string, unknown>;
    if (node.type !== 'screen') break;

    // Derive a screen key from the title
    const rawTitle = typeof node.title === 'string' ? node.title : `screen${count}`;
    const key = rawTitle
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20) || `screen${count}`;
    screens[key] = node;
    count++;

    // Advance past this object. chunk starts at position 0 of remaining (both trimmed).
    const advance = chunk.length;
    const next = remaining.slice(advance).trim();
    if (next === remaining) break; // safety: no progress
    remaining = next;
  }

  if (count < 2) return null;

  const firstKey = Object.keys(screens)[0];
  return { type: 'navigator', initialScreen: firstKey, screens };
}

// ── Two-pass helpers (local Gemma 4 only) ────────────────────────────────────

function collectActionsFromUi(node: unknown): string[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Record<string, unknown>;
  const actions: string[] = [];
  if (n.type === 'button' && typeof n.action === 'string') {
    let action = n.action;
    if (/^(on|handle)[A-Z]/.test(action)) {
      action = typeof n.text === 'string' && n.text.trim()
        ? n.text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'doAction'
        : 'doAction';
    }
    actions.push(action);
  }
  if (n.type === 'gameView') {
    if (typeof n.tickAction === 'string') actions.push(n.tickAction);
    if (typeof n.onTapAction === 'string') actions.push(n.onTapAction);
  }
  if (n.type === 'gamepad' && Array.isArray(n.buttons)) {
    for (const btn of n.buttons as Record<string, unknown>[]) {
      if (typeof btn.action === 'string') actions.push(btn.action);
    }
  }
  if (n.type === 'navigator' && n.screens && typeof n.screens === 'object') {
    for (const screen of Object.values(n.screens as Record<string, unknown>)) {
      const s = screen as Record<string, unknown>;
      if (typeof s.onFocus === 'string') actions.push(s.onFocus);
      if (Array.isArray(s.components)) {
        for (const c of s.components) actions.push(...collectActionsFromUi(c));
      }
    }
  }
  if (Array.isArray(n.components)) {
    for (const c of n.components) actions.push(...collectActionsFromUi(c));
  }
  return [...new Set(actions)];
}

function collectBindsFromUi(node: unknown): string[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Record<string, unknown>;
  const binds: string[] = [];
  if (typeof n.bind === 'string') binds.push(n.bind);
  if (typeof n.statusBind === 'string') binds.push(n.statusBind);
  if (n.type === 'navigator' && n.screens && typeof n.screens === 'object') {
    for (const screen of Object.values(n.screens as Record<string, unknown>)) {
      const s = screen as Record<string, unknown>;
      if (Array.isArray(s.components)) {
        for (const c of s.components) binds.push(...collectBindsFromUi(c));
      }
    }
  }
  if (Array.isArray(n.components)) {
    for (const c of n.components) binds.push(...collectBindsFromUi(c));
  }
  return [...new Set(binds)];
}

function inferPermissions(code: string): string[] {
  const checks: [string, string][] = [
    ['api.camera', 'camera'],
    ['api.audioRecorder', 'audioRecorder'],
    ['api.qrScanner', 'qrScanner'],
    ['api.torch', 'torch'],
    ['api.location', 'location'],
    ['api.network', 'network'],
    ['api.storage', 'storage'],
    ['api.notifications', 'notifications'],
    ['api.linking', 'linking'],
    ['api.sensors', 'sensors'],
  ];
  return checks.filter(([call]) => code.includes(call)).map(([, perm]) => perm);
}

function makeModuleId(prompt: string): string {
  return (
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join('-')
      .slice(0, 30) || 'myapp'
  );
}

function makeModuleName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(' ');
  return ((words.charAt(0).toUpperCase() + words.slice(1)) || 'My App').slice(0, 40);
}

async function generateWithOllama(
  userPrompt: string,
  baseUrl: string,
  model: string,
  options?: {
    apiKey?: string;
    defaultModel?: string;
    language?: string;
  }
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  const root = normalizeOllamaBase(baseUrl);
  const providerLabel = 'ollama';
  if (!root) {
    return { ok: false, error: 'URL Ollama non valido.' };
  }

  const url = root.endsWith('/api') ? `${root}/chat` : `${root}/api/chat`;
  const prompt = buildModuleGenerationPrompt(userPrompt, options?.language);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.apiKey?.trim()) {
    headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  }
  // Gemma models (3 and 4) work better without constrained JSON decoding:
  // format:'json' forces syntactically valid JSON but overrides schema-following,
  // causing the model to produce a minimal flat object instead of the required structure.
  const isGemmaModel = /gemma/i.test(model);
  const makeBody = (content: string, temperature: number) => ({
    model: model.trim() || options?.defaultModel || 'gemma4e4',
    messages: [
      {
        role: 'user' as const,
        content,
      },
    ],
    stream: false,
    ...(isGemmaModel ? {} : { format: 'json' }),
    options: {
      temperature,
      num_ctx: 8192,
      num_predict: 8192,
    },
  });

  try {
    let lastGenerationError = '';
    let lastContent = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      const retryPrompt =
        attempt === 0
          ? prompt
          : buildRetryPrompt(userPrompt, lastGenerationError, lastContent);

      const res = await axios.post(url, makeBody(retryPrompt, attempt === 0 ? 0.2 : 0), {
        headers,
        timeout: 240_000,
        validateStatus: () => true,
      });

      if (res.status < 200 || res.status >= 300) {
        const detail =
          typeof res.data === 'object' && res.data != null && 'error' in res.data
            ? JSON.stringify((res.data as { error: unknown }).error)
            : JSON.stringify(res.data).slice(0, 400);
        reportGenAppError(`aiClient.${providerLabel}.http`, `Ollama HTTP ${res.status}`, { status: res.status, detail });
        return { ok: false, error: res.status === 404 ? 'Modello Ollama non trovato, controlla il nome nelle impostazioni.' : 'Ollama ha risposto con un errore.' };
      }

      const content = res.data?.message?.content;
      let parsed: unknown;

      if (typeof content === 'string') {
        lastContent = content;
        if (!content.trim()) {
          lastGenerationError = 'risposta vuota dal modello';
          reportGenAppError(`aiClient.${providerLabel}.emptyContent`, lastGenerationError, {
            attempt: attempt + 1,
          });
          continue;
        }
        try {
          parsed = parseStrictJson(content);
        } catch (e) {
          lastGenerationError = `JSON non valido: ${(e as Error).message}`;
          reportGenAppError(`aiClient.${providerLabel}.jsonParse`, e, {
            attempt: attempt + 1,
            contentHead: content.slice(0, 1200),
            contentTail: content.slice(Math.max(0, content.length - 600)),
          });
          continue;
        }
      } else if (content != null && typeof content === 'object') {
        parsed = content;
        lastContent = JSON.stringify(content).slice(0, 4000);
      } else {
        const msg = `Ollama: risposta senza message.content.`;
        reportGenAppError(`aiClient.${providerLabel}.noContent`, msg, {
          dataKeys: res.data != null && typeof res.data === 'object' ? Object.keys(res.data as object) : [],
        });
        return { ok: false, error: msg };
      }

      const validated = validateGeneratedModule(parsed);
      if (!validated.ok) {
        lastGenerationError = `validazione schema: ${validated.error}`;
        continue;
      }


      return { ok: true, data: validated.module };
    }

    return { ok: false, error: 'Ollama non ha generato un modulo valido, riprova o semplifica la richiesta.' };
  } catch (e) {
    const err = e as Error & { code?: string };
    reportGenAppError(`aiClient.${providerLabel}.catch`, e, { code: err.code, root });
    if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
      return { ok: false, error: 'Impossibile connettersi a Ollama, controlla URL e rete.' };
    }
    return { ok: false, error: 'Ollama ha risposto con un errore.' };
  }
}

async function generateWithOpenAICompatible(
  userPrompt: string,
  apiUrl: string,
  apiKey?: string,
  apiModel = 'gpt-4o-mini',
  apiMaxTokens?: number,
  apiExtraBody?: Record<string, unknown>,
  providerLabel: 'openai' | 'openai-compatible' = 'openai',
  language?: string
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  const prompt = buildModuleGenerationPrompt(userPrompt, language);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let lastGenerationError = '';
  let lastContent = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const contentPrompt =
      attempt === 0 ? prompt : buildRetryPrompt(userPrompt, lastGenerationError, lastContent);
    const body = {
      model: apiModel,
      messages: [
        {
          role: 'user',
          content: contentPrompt,
        },
      ],
      temperature: attempt === 0 ? 0.2 : 0,
      ...(apiMaxTokens != null ? { max_tokens: apiMaxTokens } : {}),
      ...(apiExtraBody ?? {}),
    };

    let res: HttpResponseLike;
    try {
      res = await axios.post(apiUrl, body, {
        headers,
        timeout: 120_000,
        validateStatus: () => true,
      });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (!err.message?.includes('Network Error') && err.code !== 'ERR_NETWORK') {
        throw e;
      }
      let fetchRes: Response;
      try {
        fetchRes = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      } catch (fetchError) {
        reportGenAppError(`aiClient.${providerLabel}.fetchNetwork`, fetchError, {
          apiUrl: apiUrl.slice(0, 120),
          axiosCode: err.code,
          axiosMessage: err.message,
        });
        throw fetchError;
      }
      const text = await fetchRes.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // keep raw text
      }
      res = { status: fetchRes.status, data };
    }

    if (res.status < 200 || res.status >= 300) {
      const detail = JSON.stringify(res.data).slice(0, 400);
      reportGenAppError(`aiClient.${providerLabel}.http`, `HTTP ${res.status}`, { status: res.status, provider: providerLabel, detail });
      const msg = res.status === 401 || res.status === 403
        ? 'API key non valida o scaduta.'
        : res.status === 429
        ? 'Limite di richieste raggiunto, riprova tra poco.'
        : 'Il provider AI ha risposto con un errore.';
      return { ok: false, error: msg };
    }

    const data = res.data as Record<string, unknown>;
    const choices = Array.isArray(data.choices) ? (data.choices as Record<string, unknown>[]) : [];
    const firstChoice = choices[0];
    const firstMessage =
      firstChoice?.message && typeof firstChoice.message === 'object'
        ? (firstChoice.message as Record<string, unknown>)
        : undefined;
    const content =
      firstMessage?.content ??
      firstChoice?.text ??
      data.output_text;

    if (typeof content !== 'string') {
      const msg = 'Formato risposta AI non riconosciuto.';
      reportGenAppError(`aiClient.${providerLabel}.badShape`, new Error(msg), {
        dataPreview: JSON.stringify(res.data).slice(0, 600),
      });
      return { ok: false, error: msg };
    }

    lastContent = content;
    if (!content.trim()) {
      lastGenerationError = 'risposta vuota dal modello';
      reportGenAppError(`aiClient.${providerLabel}.emptyContent`, new Error(lastGenerationError), {
        attempt: attempt + 1,
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseStrictJson(content);
    } catch (e) {
      lastGenerationError = `JSON non valido: ${(e as Error).message}`;
      reportGenAppError(`aiClient.${providerLabel}.jsonParse`, e, {
        attempt: attempt + 1,
        contentHead: content.slice(0, 1200),
        contentTail: content.slice(Math.max(0, content.length - 600)),
      });
      continue;
    }

    const validated = validateGeneratedModule(parsed);
    if (!validated.ok) {
      lastGenerationError = `validazione schema: ${validated.error}`;
      continue;
    }


    return { ok: true, data: validated.module };
  }

  return { ok: false, error: 'Il provider AI non ha generato un modulo valido, riprova o semplifica la richiesta.' };
}

async function generateWithClaude(
  userPrompt: string,
  baseUrl: string,
  apiKey: string | undefined,
  model = 'claude-sonnet-4-20250514',
  providerLabel: 'claude' = 'claude',
  language?: string
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  const key = apiKey?.trim();
  const trimmedBase = baseUrl.trim().replace(/\/+$/, '');
  const root = trimmedBase || 'https://api.anthropic.com/v1';
  if (!key) {
    return { ok: false, error: 'Claude API: inserisci una API key Anthropic nelle impostazioni.' };
  }

  const url = root.endsWith('/v1') ? joinUrl(root, 'messages') : joinUrl(root, 'v1/messages');
  const prompt = buildModuleGenerationPrompt(userPrompt, language);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': key || 'ollama',
    'anthropic-version': '2023-06-01',
  };

  let lastGenerationError = '';
  let lastContent = '';

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const contentPrompt =
        attempt === 0 ? prompt : buildRetryPrompt(userPrompt, lastGenerationError, lastContent);
      const res = await axios.post(
        url,
        {
          model: model.trim() || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          temperature: attempt === 0 ? 0.2 : 0,
          messages: [
            {
              role: 'user',
              content: contentPrompt,
            },
          ],
        },
        {
          headers,
          timeout: 180_000,
          validateStatus: () => true,
        }
      );

      if (res.status < 200 || res.status >= 300) {
        const detail = JSON.stringify(res.data).slice(0, 500);
        reportGenAppError(`aiClient.${providerLabel}.http`, `Claude HTTP ${res.status}`, { status: res.status, detail });
        const msg = res.status === 401 || res.status === 403
          ? 'API key Claude non valida o scaduta.'
          : res.status === 429
          ? 'Limite di richieste Claude raggiunto, riprova tra poco.'
          : 'Claude ha risposto con un errore.';
        return { ok: false, error: msg };
      }

      const data = res.data as Record<string, unknown>;
      const blocks = Array.isArray(data.content) ? (data.content as Record<string, unknown>[]) : [];
      const content = blocks
        .map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
        .join('')
        .trim();

      lastContent = content;
      if (!content) {
        lastGenerationError = 'risposta vuota dal modello Claude';
        reportGenAppError(`aiClient.${providerLabel}.emptyContent`, lastGenerationError, {
          attempt: attempt + 1,
        });
        continue;
      }

      let parsed: unknown;
      try {
        parsed = parseStrictJson(content);
      } catch (e) {
        lastGenerationError = `JSON non valido: ${(e as Error).message}`;
        reportGenAppError(`aiClient.${providerLabel}.jsonParse`, e, {
          attempt: attempt + 1,
          contentHead: content.slice(0, 1200),
          contentTail: content.slice(Math.max(0, content.length - 600)),
        });
        continue;
      }

      const validated = validateGeneratedModule(parsed);
      if (!validated.ok) {
        lastGenerationError = `validazione schema: ${validated.error}`;
        continue;
      }


      return { ok: true, data: validated.module };
    }

    return { ok: false, error: 'Claude non ha generato un modulo valido, riprova o semplifica la richiesta.' };
  } catch (e) {
    const err = e as Error & { code?: string };
    reportGenAppError(`aiClient.${providerLabel}.catch`, e, { apiUrl: url.slice(0, 120), code: err.code, model });
    if (err.message?.includes('Network Error') || err.code === 'ECONNREFUSED') {
      return { ok: false, error: 'Impossibile connettersi a Claude API, controlla connessione e URL.' };
    }
    return { ok: false, error: 'Claude ha risposto con un errore.' };
  }
}

async function generateWithLocalGemma4TwoPass(
  userPrompt: string
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  // ── Pass 1: UI ────────────────────────────────────────────────────────────
  const uiPrompt = buildGemma4UiPass(userPrompt);
  let uiRaw: string;
  try {
    uiRaw = stripGemma4Tokens(await LocalLlmModule.generateText(uiPrompt));
  } catch (e) {
    const err = e as Error;
    reportGenAppError('aiClient.local.pass1.inference', e, {});
    if (err.message?.toLowerCase().includes('kv-cache') || err.message?.toLowerCase().includes('kv cache')) {
      return { ok: false, error: 'KV-cache esaurito nel pass 1 (UI). Riprova con una richiesta più semplice.' };
    }
    return { ok: false, error: `Errore pass 1 (UI): ${err.message}` };
  }

  if (!uiRaw.trim()) {
    return { ok: false, error: 'Modello locale: risposta UI vuota. Riprova.' };
  }

  let ui: unknown;
  try {
    ui = parseStrictJson(uiRaw);
  } catch {
    const repairedUi = repairLocalModelJson(uiRaw);
    try {
      ui = JSON.parse(repairedUi);
    } catch (repairErr) {
      // Fallback: model may have emitted multiple screen objects instead of a navigator.
      const wrapped = tryWrapMultipleScreensAsNavigator(uiRaw);
      if (wrapped) {
        ui = wrapped;
      } else {
        reportGenAppError('aiClient.local.pass1.jsonParse', repairErr, {
          rawHead: uiRaw.slice(0, 800),
          repairedHead: repairedUi.slice(0, 800),
          rawTail: uiRaw.slice(Math.max(0, uiRaw.length - 300)),
        });
        return { ok: false, error: 'Modello locale: UI non valida. Riprova con una richiesta più semplice.' };
      }
    }
  }

  // ── Pass 2: Code ──────────────────────────────────────────────────────────
  const actionNames = collectActionsFromUi(ui);
  const bindKeys = collectBindsFromUi(ui);
  const codePrompt = buildGemma4CodePass(userPrompt, ui, actionNames, bindKeys);

  let codeRaw: string;
  try {
    codeRaw = stripGemma4Tokens(await LocalLlmModule.generateText(codePrompt));
  } catch (e) {
    const err = e as Error;
    reportGenAppError('aiClient.local.pass2.inference', e, {});
    if (err.message?.toLowerCase().includes('kv-cache') || err.message?.toLowerCase().includes('kv cache')) {
      return { ok: false, error: 'KV-cache esaurito nel pass 2 (codice). Riprova con una richiesta più semplice.' };
    }
    return { ok: false, error: `Errore pass 2 (codice): ${err.message}` };
  }

  if (!codeRaw.trim()) {
    return { ok: false, error: 'Modello locale: risposta codice vuota. Riprova.' };
  }

  // The model turn was pre-filled with "module.exports=" — reconstruct the full string.
  // Be defensive: if the model echoed the prefix anyway, don't double it.
  // Also strip spurious outer parentheses: model sometimes emits ({actions:...}) or ({actions:...}
  // instead of {actions:...}. The unmatched ( causes ')' expected compilation errors in Hermes.
  let codeBody = stripJsonFences(codeRaw).trim();
  // Strip trailing backtick(s) — leftover from a code-fence the model appended after the closing }
  // e.g. "module.exports={...})`" → "module.exports={...})" so the ) check below works
  codeBody = codeBody.replace(/`+$/, '').trim();
  // Strip outer () wrapping: ({...}) → {...}
  if (codeBody.startsWith('(') && !codeBody.startsWith('()')) {
    codeBody = codeBody.slice(1).trim();
    if (codeBody.endsWith(')')) codeBody = codeBody.slice(0, -1).trim();
  }
  // Strip module.exports=( wrapping: module.exports=({...}) → module.exports={...}
  if (/^module\.exports\s*=\s*\(/.test(codeBody)) {
    codeBody = codeBody.replace(/^(module\.exports\s*=\s*)\(/, '$1').trim();
    if (codeBody.endsWith(')')) codeBody = codeBody.slice(0, -1).trim();
  }
  // Strip stray trailing ) or ); when code ends with }) or });
  // e.g. {actions:{...}}) → {actions:{...}}, {actions:{...}}); → {actions:{...}}
  // The regex must match ; too because the model often emits `module.exports={...});`
  if (/\}\s*\)\s*;?\s*$/.test(codeBody) && !/^module\.exports\s*=\s*\(/.test(codeBody)) {
    codeBody = codeBody.replace(/\)\s*;?\s*$/, '').trim();
  }
  // Same strip for when codeBody already carries the module.exports= prefix
  // e.g. module.exports={...}); → module.exports={...}
  if (/^module\.exports\s*=/.test(codeBody) && /\}\s*\)\s*;?\s*$/.test(codeBody)) {
    codeBody = codeBody.replace(/\)\s*;?\s*$/, '').trim();
  }
  const code = /^module\.exports/.test(codeBody) ? codeBody : 'module.exports=' + codeBody;

  // ── Manifest autopilot ────────────────────────────────────────────────────
  const manifest = {
    id: makeModuleId(userPrompt),
    name: makeModuleName(userPrompt),
    version: '1.0.0',
    runtime: 'javascript' as const,
    permissions: inferPermissions(code),
    entry: 'logic.js',
    ui: 'ui.json',
  };

  // ── Validate ──────────────────────────────────────────────────────────────
  const assembled = { manifest, ui, code };
  const validated = validateGeneratedModule(assembled);
  if (!validated.ok) {
    reportGenAppError('aiClient.local.twoPass.validate', new Error(validated.error), {
      uiType: (ui as Record<string, unknown>)?.type,
      codeHead: code.slice(0, 300),
    });
    return { ok: false, error: `Modulo non valido: ${validated.error}. Riprova.` };
  }

  return { ok: true, data: validated.module };
}

/**
 * Parses the tagged format produced by the fine-tuned model:
 *
 *   <ui>
 *   {"type":"screen",...}
 *   </ui>
 *   <code>
 *   module.exports={actions:{...}}
 *   </code>
 *
 * The manifest is NOT in the model output — it is built by the caller
 * (generateWithLocalFinetuned) using makeModuleId/makeModuleName/inferPermissions.
 *
 * Returns { ui, code } on success, or null if neither tagged nor legacy format is found.
 */
function parseFinetunedOutput(raw: string): { ui: unknown; code: string } | null {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').trim();

  // ── Primary: tagged format ────────────────────────────────────────────────
  const uiMatch   = cleaned.match(/<ui>\s*([\s\S]*?)\s*<\/ui>/i);
  const codeMatch = cleaned.match(/<code>\s*([\s\S]*?)\s*<\/code>/i);

  if (uiMatch && codeMatch) {
    const uiStr   = uiMatch[1].trim();
    const codeStr = codeMatch[1].trim();

    let ui: unknown = null;
    try {
      ui = JSON.parse(uiStr);
    } catch {
      // try repair (trailing comma, unquoted keys, etc.)
      try { ui = JSON.parse(repairLocalModelJson(uiStr)); } catch { /* fall through */ }
    }
    if (!ui) return null;

    const code = codeStr.startsWith('module.exports') ? codeStr : 'module.exports=' + codeStr;
    return { ui, code };
  }

  // ── Legacy fallback: single JSON object (old training format) ────────────
  try {
    const parsed = parseStrictJson(cleaned) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && 'ui' in parsed && 'code' in parsed) {
      return { ui: parsed.ui, code: String(parsed.code ?? '') };
    }
  } catch { /* fall through */ }

  return null;
}

/**
 * Single-pass inference for the AppFromAI fine-tuned model.
 * Prompt is ~20 tokens — no schema, no examples (learned during training).
 *
 * Output format:
 *   <ui>{"type":"screen",...}</ui>
 *   <code>module.exports={actions:{...}}</code>
 *
 * Manifest is assembled here from the prompt (no tokens wasted on it by the model).
 */
async function generateWithLocalFinetuned(
  userPrompt: string
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  const prompt = buildFinetunedPrompt(userPrompt);
  let lastContent = '';
  let lastGenerationError = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    let content: string;
    try {
      content = stripGemma4Tokens(await LocalLlmModule.generateText(prompt));
    } catch (e: unknown) {
      const err = e as Error;
      reportGenAppError('aiClient.finetuned.inference', e, { attempt: attempt + 1 });
      return { ok: false, error: err.message || 'Errore nel modello locale fine-tunato' };
    }

    lastContent = content;
    if (!content.trim()) {
      lastGenerationError = 'risposta vuota';
      reportGenAppError('aiClient.finetuned.emptyContent', new Error(lastGenerationError), { attempt: attempt + 1 });
      continue;
    }

    const parts = parseFinetunedOutput(content);
    if (!parts) {
      lastGenerationError = 'output non parsabile (nessun tag <ui>/<code> trovato)';
      reportGenAppError('aiClient.finetuned.parse', new Error(lastGenerationError), {
        attempt: attempt + 1,
        contentHead: content.slice(0, 600),
        contentTail: content.slice(Math.max(0, content.length - 300)),
      });
      continue;
    }

    // Build manifest from the prompt — same approach as generateWithLocalGemma4TwoPass
    const manifest = {
      id:          makeModuleId(userPrompt),
      name:        makeModuleName(userPrompt),
      version:     '1.0.0',
      runtime:     'javascript' as const,
      permissions: inferPermissions(parts.code),
      entry:       'logic.js',
      ui:          'ui.json',
    };

    const assembled = { manifest, ui: parts.ui, code: parts.code };
    const validated = validateGeneratedModule(assembled);
    if (!validated.ok) {
      lastGenerationError = `validazione schema: ${validated.error}`;
      reportGenAppError('aiClient.finetuned.validate', new Error(lastGenerationError), { attempt: attempt + 1 });
      continue;
    }

    return { ok: true, data: validated.module };
  }

  return {
    ok: false,
    error: `Modello fine-tunato: output non valido dopo retry: ${lastGenerationError}. Contenuto (prime 300 char): ${lastContent.slice(0, 300)}`,
  };
}

async function generateWithLocal(
  userPrompt: string,
  localModelId?: string
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  if (!LocalLlmModule.isSupported) {
    return { ok: false, error: 'Local model inference is only available on Android after a native build.' };
  }

  if (localModelId) {
    const currentId = await LocalLlmModule.getLoadedModelId();
    if (currentId !== localModelId) {
      try {
        await LocalLlmModule.loadModel(localModelId);
      } catch (e: unknown) {
        const err = e as Error;
        return { ok: false, error: `Impossibile caricare il modello "${localModelId}": ${err.message}` };
      }
    }
  }

  // Bypass model generation for known game types — pre-built templates are 100% reliable.
  const builtinGame = detectBuiltinGame(userPrompt);
  if (builtinGame) {
    const { ui, code } = BUILTIN_GAMES[builtinGame];
    const manifest = {
      id: makeModuleId(userPrompt),
      name: makeModuleName(userPrompt),
      version: '1.0.0',
      runtime: 'javascript' as const,
      permissions: [],
      entry: 'logic.js',
      ui: 'ui.json',
    };
    const validated = validateGeneratedModule({ manifest, ui, code });
    if (validated.ok) return { ok: true, data: validated.module };
    // Validation failed (shouldn't happen) — fall through to model generation
    reportGenAppError('aiClient.local.builtinGame.validate', new Error('builtin validation failed'), { builtinGame });
  }

  // Modello fine-tunato AppFromAI: single-pass con prompt ultra-corto (~20 token).
  if (localModelId === 'gemma4-appfromai') {
    return generateWithLocalFinetuned(userPrompt);
  }

  // Gemma 4 E2B/E4B base: two-pass generation keeps each inference well within the 8192 KV-cache budget.
  const isGemma4 = localModelId === 'gemma4-e2b' || localModelId === 'gemma4-e4b';
  if (isGemma4) {
    return generateWithLocalGemma4TwoPass(userPrompt);
  }

  // ── Single-pass for smaller models (Gemma 3 1B, Qwen 2.5 1.5B, DeepSeek R1 1.5B) ──
  const prompt = buildSmallModelPrompt(userPrompt);
  let lastGenerationError = '';
  let lastContent = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    let content: string;
    try {
      content = stripGemma4Tokens(await LocalLlmModule.generateText(prompt));
    } catch (e: unknown) {
      const err = e as Error;
      reportGenAppError('aiClient.local.inference', e, { attempt: attempt + 1 });
      if (err.message?.toLowerCase().includes('kv-cache') || err.message?.toLowerCase().includes('kv cache')) {
        return { ok: false, error: 'Risposta troppo lunga per il modello locale. Prova con una richiesta più semplice o un modello con contesto maggiore.' };
      }
      return { ok: false, error: err.message || 'Errore nel modello locale' };
    }

    lastContent = content;
    if (!content.trim()) {
      lastGenerationError = 'risposta vuota dal modello locale';
      reportGenAppError('aiClient.local.emptyContent', new Error(lastGenerationError), { attempt: attempt + 1 });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseStrictJson(content);
    } catch {
      try {
        parsed = JSON.parse(repairLocalModelJson(content));
      } catch (e) {
        lastGenerationError = `JSON non valido: ${(e as Error).message}`;
        reportGenAppError('aiClient.local.jsonParse', e, {
          attempt: attempt + 1,
          contentHead: content.slice(0, 1200),
          contentTail: content.slice(Math.max(0, content.length - 600)),
        });
        continue;
      }
    }

    const validated = validateGeneratedModule(parsed);
    if (!validated.ok) {
      lastGenerationError = `validazione schema: ${validated.error}`;
      continue;
    }

    return { ok: true, data: validated.module };
  }

  return {
    ok: false,
    error: `Local: modulo non valido anche dopo retry: ${lastGenerationError}. Contenuto (prime 500 char): ${lastContent.slice(0, 500)}`,
  };
}

export async function generateModule(
  userPrompt: string,
  opts: AiClientOptions
): Promise<{ ok: true; data: GeneratedModulePayload } | { ok: false; error: string }> {
  if (opts.useMock) {
    const mock = pickMockModule(userPrompt);
    if (mock) {
      return { ok: true, data: mock };
    }
    const msg =
      'Modalità mock: nessun modulo predefinito per questa richiesta. Prova “calcolatrice”, “audio” o “qr”.';
    reportGenAppError('aiClient.mock.noMatch', new Error(msg), { promptPreview: userPrompt.slice(0, 200) });
    return { ok: false, error: msg };
  }

  if (opts.useLocalProvider) {
    return generateWithLocal(userPrompt, opts.localModelId);
  }

  const ollamaUrl = opts.ollamaBaseUrl?.trim();
  if (ollamaUrl) {
    return generateWithOllama(userPrompt, ollamaUrl, opts.ollamaModel?.trim() || 'gemma4e4', { language: opts.language });
  }

  if (opts.apiProvider === 'claude') {
    return generateWithClaude(
      userPrompt,
      opts.claudeBaseUrl?.trim() || 'https://api.anthropic.com/v1',
      opts.claudeApiKey,
      opts.claudeModel || 'claude-sonnet-4-20250514',
      'claude',
      opts.language
    );
  }

  if (opts.apiUrl?.trim()) {
    try {
      return await generateWithOpenAICompatible(
        userPrompt,
        opts.apiUrl.trim(),
        opts.apiKey,
        opts.apiModel,
        opts.apiMaxTokens,
        opts.apiExtraBody,
        'openai',
        opts.language
      );
    } catch (e) {
      const err = e as Error & { code?: string };
      const apiUrl = opts.apiUrl.trim();
      const msg =
        err.message?.includes('Network Error') || err.code
          ? `Errore di rete verso API (${apiUrl}). Controlla connessione internet, URL e firewall.`
          : err.message || 'Errore di rete';
      reportGenAppError('aiClient.openai.catch', e, {
        apiUrl: apiUrl.slice(0, 120),
        code: err.code,
      });
      return { ok: false, error: msg };
    }
  }

  const msg =
    'Imposta URL Ollama (es. http://IP:11434) oppure URL API OpenAI-compatible, oppure usa il mock.';
  reportGenAppError('aiClient.noProvider', new Error(msg), {});
  return { ok: false, error: msg };
}
