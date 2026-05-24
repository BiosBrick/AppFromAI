import { z } from 'zod';
import { finalizeModuleCodeForVm } from '../modules/moduleRunner';
import { MOTHER_ALLOWED_PERMISSIONS } from '../types/generatedModule';

function slugManifestId(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) s = 'modulo';
  if (!/^[a-z0-9]/.test(s)) s = `m-${s}`;
  return s;
}

function semverish(v: unknown): string {
  if (typeof v !== 'string') return '1.0.0';
  const s = v.trim();
  if (/^\d+\.\d+\.\d+/.test(s)) return s;
  const parts = s.split('.').filter((p) => p.length > 0);
  if (parts.length === 1) return `${parts[0]}.0.0`;
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function filterPermissions(p: unknown): string[] {
  if (!Array.isArray(p)) return [];
  const allowed = new Set<string>(MOTHER_ALLOWED_PERMISSIONS as unknown as string[]);
  return p.filter((x): x is string => typeof x === 'string' && allowed.has(x));
}

function normalizeKeyboardType(
  v: unknown
): 'default' | 'numeric' | 'decimal-pad' | undefined {
  if (v == null || v === '') return undefined;
  const s = String(v).toLowerCase().replace(/_/g, '-');
  if (s === 'numeric' || s === 'number' || s === 'numbers-and-punctuation') return 'numeric';
  if (s === 'decimal-pad' || s === 'decimal') return 'decimal-pad';
  if (s === 'default') return 'default';
  return undefined;
}

function normalizeVariant(v: unknown): 'primary' | 'secondary' | 'danger' | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.toLowerCase();
  if (s === 'primary' || s === 'secondary' || s === 'danger') return s;
  return undefined;
}

function canonComponentType(t: string): string {
  const x = t.trim().toLowerCase();
  if (x === 'audiorecorder') return 'audioRecorder';
  if (x === 'qrscanner') return 'qrScanner';
  if (x === 'gameview' || x === 'game-view') return 'gameView';
  if (x === 'label' || x === 'paragraph' || x === 'p' || x === 'span' || x === 'title' || x === 'heading' || x === 'h1' || x === 'h2' || x === 'h3') return 'text';
  if (x === 'textfield' || x === 'textinput' || x === 'textbox' || x === 'field') return 'input';
  if (x === 'multilineinput' || x === 'multiline' || x === 'text-area') return 'textarea';
  if (x === 'img' || x === 'photo' || x === 'picture') return 'image';
  if (x === 'ul' || x === 'ol' || x === 'recycler' || x === 'flatlist') return 'list';
  if (x === 'panel' || x === 'section') return 'card';
  if (x === 'spacer' || x === 'divider') return 'spacer';
  if (x === 'hstack' || x === 'horizontal' || x === 'rowcontainer') return 'hstack';
  if (x === 'vstack' || x === 'vertical' || x === 'columncontainer') return 'vstack';
  if (x === 'row' || x === 'flexrow' || x === 'hrow') return 'hstack';
  if (x === 'column' || x === 'col' || x === 'flexcolumn' || x === 'stack') return 'vstack';
  if (x === 'container' || x === 'view' || x === 'group' || x === 'fragment' || x === 'div') return 'vstack';
  return x;
}

/**
 * Alcuni modelli mettono in components stringhe o valori spuri; Zod richiede solo oggetti nodo.
 */
function normalizeComponentsList(items: unknown, path: string): unknown[] {
  if (!Array.isArray(items)) return [];
  const out: unknown[] = [];
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    if (c == null || typeof c !== 'object' || Array.isArray(c)) continue;
    out.push(normalizeUiNode(c, `${path}[${out.length}]`));
  }
  return out;
}

function normalizeUiNode(node: unknown, path: string): unknown {
  if (node == null || typeof node !== 'object' || Array.isArray(node)) return node;
  const n = { ...(node as Record<string, unknown>) };
  const rawType = n.type;
  const rawTypeKey = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  let type = typeof rawType === 'string' ? canonComponentType(rawType) : '';
  const isGameCanvasAlias =
    ['canvas', 'game', 'gamecanvas', 'game-canvas', 'playfield'].includes(rawTypeKey) &&
    (!Array.isArray(n.components) || n.tickAction != null || n.onTapAction != null);
  if (isGameCanvasAlias) {
    type = 'gameView';
  }
  if (type === 'hstack') {
    type = 'box';
    n.type = 'box';
    n.direction = 'row';
  } else if (type === 'vstack') {
    type = 'box';
    n.type = 'box';
    n.direction = 'column';
  } else {
    n.type = type;
  }

  if (type === 'navigator') {
    // Normalizza ogni schermata e i suoi componenti.
    if (n.screens && typeof n.screens === 'object' && !Array.isArray(n.screens)) {
      const screens: Record<string, unknown> = {};
      for (const [key, screenVal] of Object.entries(n.screens as Record<string, unknown>)) {
        if (screenVal && typeof screenVal === 'object' && !Array.isArray(screenVal)) {
          const s = { ...(screenVal as Record<string, unknown>) };
          s.type = 'screen';
          if (typeof s.title !== 'string') s.title = key;
          s.components = normalizeComponentsList(
            s.components,
            `${path}.screens.${key}.components`
          );
          // Preserva onFocus solo se è una stringa valida.
          if (typeof s.onFocus !== 'string' || !s.onFocus) delete s.onFocus;
          screens[key] = s;
        }
      }
      n.screens = screens;
    }
    if (typeof n.initialScreen !== 'string' || !n.initialScreen) {
      const firstKey = n.screens && typeof n.screens === 'object'
        ? Object.keys(n.screens as object)[0] ?? 'home'
        : 'home';
      n.initialScreen = firstKey;
    }
    return n;
  }

  if (type === 'screen') {
    if (typeof n.title !== 'string') n.title = 'Modulo';
    n.components = normalizeComponentsList(n.components, `${path}.components`);
    return n;
  }

  if (type === 'spacer') {
    const height = typeof n.height === 'number' ? n.height : 12;
    return { type: 'box', direction: 'column', components: [], layout: { height } };
  }

  if (type === 'card') {
    n.components = normalizeComponentsList(n.components, `${path}.components`);
    return n;
  }

  if (type === 'box') {
    const d = n.direction;
    n.direction = d === 'row' || d === 'column' ? d : 'column';
    n.components = normalizeComponentsList(n.components, `${path}.components`);
    return n;
  }

  if (type === 'button') {
    const hasNavigate = typeof n.navigate === 'string' && !!n.navigate;
    // Derive a meaningful action name from the button text instead of defaulting to 'onPress'
    // (which would cause action mismatch since generated code never has an "onPress" action).
    const deriveAction = (text: unknown): string => {
      if (typeof text !== 'string' || !text.trim()) return 'doAction';
      return text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'doAction';
    };
    const isReactHandler = typeof n.action === 'string' && /^(on|handle)[A-Z]/.test(n.action);
    if (!hasNavigate && (typeof n.action !== 'string' || !n.action || isReactHandler)) {
      n.action = deriveAction(n.text);
    }
    if (typeof n.text !== 'string') n.text = 'OK';
    if (typeof n.id !== 'string' || !n.id) {
      const idBase =
        typeof n.action === 'string' && n.action
          ? n.action
          : typeof n.navigate === 'string' && n.navigate
          ? `nav-${n.navigate}`
          : 'btn';
      n.id = `btn-${idBase.replace(/[^a-z0-9-]/gi, '-')}`;
    }
    if (n.actionInput == null && n.input != null && typeof n.input === 'object' && !Array.isArray(n.input)) {
      n.actionInput = n.input;
    }
    delete n.input;
    const v = normalizeVariant(n.variant);
    if (v) n.variant = v;
    else delete n.variant;
    return n;
  }

  if (type === 'input' || type === 'textarea') {
    if (typeof n.bind !== 'string' || !n.bind) n.bind = 'field';
    if (typeof n.id !== 'string' || !n.id) n.id = String(n.bind).replace(/[^a-z0-9-]/gi, '-') || 'field';
    const kt = normalizeKeyboardType(n.keyboardType);
    if (kt) n.keyboardType = kt;
    else delete n.keyboardType;
    return n;
  }

  if (type === 'list') {
    if (typeof n.bind !== 'string' || !n.bind) n.bind = 'items';
    return n;
  }

  if (type === 'image') {
    if (typeof n.bind !== 'string' || !n.bind) n.bind = 'imageUri';
    if (typeof n.height === 'string') {
      const h = parseFloat(n.height);
      if (!Number.isNaN(h)) n.height = h;
    }
    return n;
  }

  if (type === 'text' || type === 'audioRecorder' || type === 'qrScanner') {
    if (type === 'text' && typeof n.text !== 'string') {
      if (typeof n.label === 'string') n.text = n.label;
      else if (typeof n.content === 'string') n.text = n.content;
      else if (typeof n.value === 'string') n.text = n.value;
      else n.text = '';
    }
    return n;
  }

  if (type === 'gamepad') {
    if (!Array.isArray(n.buttons)) n.buttons = [];
    n.buttons = (n.buttons as unknown[]).filter(
      (b): b is Record<string, unknown> => b != null && typeof b === 'object' && !Array.isArray(b)
    ).map((b) => ({
      ...b,
      id:     typeof b.id     === 'string' && b.id     ? b.id     : `btn-${Math.random().toString(36).slice(2, 6)}`,
      label:  typeof b.label  === 'string'             ? b.label  : '?',
      action: typeof b.action === 'string'             ? b.action : '',
      ...(b.hold != null ? { hold: !!b.hold } : {}),
      ...(b.holdMs != null ? { holdMs: Math.max(16, Number(b.holdMs) || 80) } : {}),
    }));
    const dir = String(n.direction ?? '');
    if (!['row', 'dpad', 'split'].includes(dir)) delete n.direction;
    if (n.buttonSize != null) {
      const sz = Number(n.buttonSize);
      n.buttonSize = Number.isFinite(sz) && sz > 0 ? Math.round(sz) : 64;
    }
    return n;
  }

  if (type === 'gameView') {
    if (typeof n.bind !== 'string' || !n.bind) n.bind = 'scene';
    if (n.tickMs != null) {
      const ms = Number(n.tickMs);
      n.tickMs = Number.isFinite(ms) && ms >= 16 ? Math.round(ms) : 50;
    }
    if (typeof n.tickAction !== 'string' || !n.tickAction) delete n.tickAction;
    if (typeof n.onTapAction !== 'string' || !n.onTapAction) delete n.onTapAction;
    return n;
  }

  if (Array.isArray(n.components)) {
    n.type = 'box';
    n.direction = 'column';
    n.components = normalizeComponentsList(n.components, `${path}.components`);
    return n;
  }

  return { type: 'text', text: typeof n.text === 'string' ? n.text : '' };
}

/** La radice UI deve essere { type: "screen", ... } o { type: "navigator", ... }. */
function normalizeUiRoot(ui: unknown): unknown {
  if (Array.isArray(ui)) {
    return { type: 'screen', title: 'Modulo', components: ui };
  }
  if (ui == null || typeof ui !== 'object') return ui;
  const o = ui as Record<string, unknown>;
  const t = typeof o.type === 'string' ? o.type.toLowerCase() : '';
  // Radici valide: screen e navigator — non avvolgere mai un navigator in uno screen.
  if (t === 'screen') return o;
  if (t === 'navigator') return o;
  if (Array.isArray(o.components)) {
    return {
      type: 'screen',
      title: typeof o.title === 'string' ? o.title : 'Modulo',
      components: o.components,
    };
  }
  return {
    type: 'screen',
    title: 'Modulo',
    components: [o],
  };
}

function unwrapModuleRoot(raw: Record<string, unknown>): Record<string, unknown> {
  if ('manifest' in raw && 'ui' in raw && 'code' in raw) return raw;
  for (const k of ['module', 'result', 'output', 'data', 'json', 'payload']) {
    const inner = raw[k];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const o = inner as Record<string, unknown>;
      if ('manifest' in o && 'ui' in o && 'code' in o) return o;
    }
  }
  return raw;
}

/**
 * Adatta risposte LLM (Ollama, ecc.) allo schema atteso prima di Zod.
 */
export function normalizeGeneratedModuleRaw(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  let root = unwrapModuleRoot({ ...(raw as Record<string, unknown>) });

  const manifest = root.manifest;
  const ui = root.ui;
  let code = root.code;

  if (typeof code !== 'string') {
    if (code != null && typeof code === 'object') {
      code = JSON.stringify(code);
    } else if (code != null) {
      code = String(code);
    } else {
      code = 'module.exports = { actions: {} };';
    }
  }

  if (typeof code === 'string') {
    code = finalizeModuleCodeForVm(code);
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ...root, code };
  }

  const m = { ...(manifest as Record<string, unknown>) };
  if (typeof m.id === 'string') m.id = slugManifestId(m.id);
  else if (m.id != null) m.id = slugManifestId(String(m.id));
  else m.id = 'modulo';

  if (typeof m.name !== 'string' || !m.name.trim()) m.name = 'Modulo generato';
  m.version = semverish(m.version);
  m.runtime = 'javascript';
  if (typeof m.entry !== 'string' || !m.entry) m.entry = 'logic.js';
  if (typeof m.ui !== 'string' || !m.ui) m.ui = 'ui.json';
  m.permissions = filterPermissions(m.permissions);

  const uiRoot = normalizeUiRoot(ui);
  const uiNorm = normalizeUiNode(uiRoot, 'ui');

  return {
    manifest: m,
    ui: uiNorm,
    code,
  };
}

export function formatZodError(err: z.ZodError): string {
  const lines = err.issues.slice(0, 8).map((i) => {
    const p = i.path.length ? i.path.map(String).join('.') : '(root)';
    return `${p}: ${i.message}`;
  });
  const more = err.issues.length > 8 ? ` … altri ${err.issues.length - 8} errori` : '';
  return lines.join('\n') + more;
}
