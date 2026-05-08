import {
  generatedModuleSchema,
  type GeneratedModulePayload,
  type StoredModule,
} from '../types/generatedModule';
import type { UiNode } from '../types/uiNodes';
import { formatZodError, normalizeGeneratedModuleRaw } from '../ai/normalizeGeneratedModule';
import { reportGenAppError } from '../debug/genAppDebug';
import { scanGeneratedCode } from '../security/codeScanner';
import { tryCompileModuleActions } from './moduleRunner';

function collectButtonActions(node: UiNode): string[] {
  // Se il button ha navigate, l'action è opzionale e non va validata
  if (node.type === 'button') return node.action && !node.navigate ? [node.action] : [];
  if (node.type === 'navigator') {
    return Object.values(node.screens).flatMap((s) => {
      const childActions = s.components.flatMap(collectButtonActions);
      // Includi anche onFocus nella lista delle action da validare.
      return s.onFocus ? [s.onFocus, ...childActions] : childActions;
    });
  }
  if (node.type === 'gamepad') {
    return node.buttons.map((b) => b.action).filter(Boolean);
  }
  if (node.type === 'gameView') {
    const acts: string[] = [];
    if (node.tickAction) acts.push(node.tickAction);
    if (node.onTapAction) acts.push(node.onTapAction);
    if (node.onCollideAction) acts.push(node.onCollideAction);
    if (node.onOutOfBoundsAction) acts.push(node.onOutOfBoundsAction);
    return acts;
  }
  if ('components' in node && Array.isArray(node.components)) {
    return node.components.flatMap(collectButtonActions);
  }
  return [];
}

function formatCodeScanError(reason: string): string {
  if (reason.includes('eval(')) {
    return `${reason} — Rigenera senza eval: per calcolatrici usa stato (display, operatore, operandi) e operazioni esplicite tra numeri, non eval sulla stringa del display.`;
  }
  if (reason.includes('Function(') || reason.includes('new Function')) {
    return `${reason} — Non usare Function per valutare espressioni; stesso divieto di eval.`;
  }
  return reason;
}

export type ValidateResult =
  | { ok: true; module: GeneratedModulePayload }
  | { ok: false; error: string };

export function validateGeneratedModule(raw: unknown): ValidateResult {
  const normalized = normalizeGeneratedModuleRaw(raw);
  const parsed = generatedModuleSchema.safeParse(normalized);
  if (!parsed.success) {
    const errText = formatZodError(parsed.error);
    reportGenAppError('moduleValidator.zod', new Error(errText), {
      zodIssues: parsed.error.issues?.slice(0, 20),
      normalizedKeys:
        normalized != null && typeof normalized === 'object'
          ? Object.keys(normalized as object).slice(0, 30)
          : [],
    });
    return { ok: false, error: 'Il modulo generato ha una struttura non valida.' };
  }
  const scan = scanGeneratedCode(parsed.data.code);
  if (!scan.ok) {
    reportGenAppError('moduleValidator.codeScan', new Error(scan.reason), {
      codeHead: parsed.data.code.slice(0, 800),
    });
    return { ok: false, error: 'Il codice contiene istruzioni non permesse.' };
  }

  const compileResult = tryCompileModuleActions(parsed.data.code);
  if (!compileResult.ok) {
    reportGenAppError('moduleValidator.compile', new Error(compileResult.error), {
      codeHead: parsed.data.code.slice(0, 800),
    });
    return { ok: false, error: 'Il codice del modulo non è eseguibile.' };
  }
  const uiActions = [...new Set(collectButtonActions(parsed.data.ui))];
  const missing = uiActions.filter((a) => !(a in compileResult.actions));
  if (missing.length > 0) {
    reportGenAppError('moduleValidator.actionMismatch', new Error(`Azioni mancanti: ${missing.join(', ')}`), {
      uiActions,
      compiledActions: Object.keys(compileResult.actions),
    });
    return { ok: false, error: 'Le azioni del modulo non corrispondono al codice.' };
  }

  return { ok: true, module: parsed.data };
}

export function validateJsonString(json: string): ValidateResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    const msg = `JSON non valido: ${(e as Error).message}`;
    reportGenAppError('moduleValidator.jsonString', e, { jsonHead: json.slice(0, 400) });
    return { ok: false, error: msg };
  }
  return validateGeneratedModule(data);
}

export function toStoredModule(payload: GeneratedModulePayload, prompt?: string): StoredModule {
  return {
    id: payload.manifest.id,
    name: payload.manifest.name,
    version: payload.manifest.version,
    manifest: payload.manifest,
    ui: payload.ui,
    code: payload.code,
    createdAt: new Date().toISOString(),
    permissions: payload.manifest.permissions,
    ...(prompt ? { prompt } : {}),
  };
}
