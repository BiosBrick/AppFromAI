import axios from 'axios';
import { buildModuleGenerationPrompt, getJsonResponseRetryHint } from './modulePrompt';
import { pickMockModule } from './mockModules';
import type { GeneratedModulePayload } from '../types/generatedModule';
import { reportGenAppError } from '../debug/genAppDebug';
import { validateGeneratedModule } from '../modules/moduleValidator';

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
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(extractFirstJsonObject(cleaned));
  }
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
- Forma esatta: module.exports = { actions: { async onTick(api, input, state) { ... return {...}; }, async onTap(api, input, state) { ... return {...}; } } };
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
async onTick(api,input,state){const W=320,H=420,R=10,G=0.5;const x=parseFloat(String(state.x??'160'));const y=parseFloat(String(state.y??'80'));const vx=parseFloat(String(state.vx??'3'));const vy=parseFloat(String(state.vy??'3'));const nx=x+vx;const ny=y+vy+G;const nvx=(nx<R||nx>W-R)?-vx:vx;const nvy=(ny<R)?-vy:(ny>H-R)?-Math.abs(vy)*0.8:vy+G;return{x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),vx:nvx,vy:nvy,scene:[{type:'rect',x:0,y:0,w:W,h:H,color:'#111'},{type:'circle',x:Math.max(R,Math.min(W-R,nx)),y:Math.max(R,Math.min(H-R,ny)),r:R,color:'#6cf'}]};}
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
{"manifest":{"id":"id-minuscolo","name":"Nome","version":"1.0.0","runtime":"javascript","permissions":[],"entry":"logic.js","ui":"ui.json"},"ui":{"type":"screen","title":"Nome","components":[{"type":"gameView","id":"game","bind":"scene","width":320,"height":420,"tickMs":60,"tickAction":"onTick","onTapAction":"onTap"}]},"code":"module.exports={actions:{async onTick(api,input,state){return{scene:[]};},async onTap(api,input,state){return{};}}};"  }

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
  const makeBody = (content: string, temperature: number) => ({
    model: model.trim() || options?.defaultModel || 'gemma4e4',
    messages: [
      {
        role: 'user' as const,
        content,
      },
    ],
    stream: false,
    format: 'json',
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
