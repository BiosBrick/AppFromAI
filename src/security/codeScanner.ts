/**
 * Analisi statica leggera sul codice generato.
 * Non sostituisce una sandbox robusta: limita superficie d'attacco comune.
 */

const FORBIDDEN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'eval(', re: /\beval\s*\(/i },
  { name: 'Function(', re: /\bFunction\s*\(/ },
  { name: 'new Function', re: /\bnew\s+Function\b/i },
  { name: 'require(', re: /\brequire\s*\(/ },
  { name: 'import()', re: /\bimport\s*\(/ },
  {
    name: 'import (ESM)',
    re: /\bimport\s+(?:type\s+)?[\w*{}\s,$]+\s+from\s+['"`]/,
  },
  { name: 'import side-effect', re: /\bimport\s+['"`]/ },
  { name: 'export (ESM)', re: /\bexport\s+(default\s+)?/ },
  { name: 'process', re: /\bprocess\b/ },
  { name: 'global', re: /\bglobalThis\b|\bglobal\b/ },
  { name: 'child_process', re: /child_process/ },
  { name: 'Linking diretto', re: /\bLinking\s*\./ },
  { name: '__dirname', re: /\b__dirname\b/ },
  { name: '__filename', re: /\b__filename\b/ },
  { name: 'fs access', re: /\bfs\.\b|node:fs|react-native-fs|expo-file-system\/FileSystem\b/ },
  { name: 'dynamic import', re: /\bimport\s*\(\s*['"`]/ },
];

const SUSPICIOUS_LOOP_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'while(true)', re: /\bwhile\s*\(\s*true\s*\)/ },
  { name: 'for(;;)', re: /\bfor\s*\(\s*;\s*;\s*\)/ },
];

/**
 * Sostituisce con spazi il contenuto di stringhe e commenti così i regex non matchano
 * false positive (es. la parola "eval" in un messaggio utente tra virgolette).
 */
function maskStringsLineAndBlockComments(code: string): string {
  let result = '';
  let i = 0;
  let inStr = false;
  let strChar = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < code.length) {
    const c = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (inLineComment) {
      result += c === '\n' ? '\n' : ' ';
      if (c === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        result += '  ';
        i += 2;
        inBlockComment = false;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    if (escaped) {
      result += ' ';
      escaped = false;
      i++;
      continue;
    }

    if (inStr) {
      if (c === '\\') {
        result += ' ';
        escaped = true;
        i++;
        continue;
      }
      if (c === strChar) {
        result += c;
        inStr = false;
        i++;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    if (c === '/' && next === '/') {
      inLineComment = true;
      result += '  ';
      i += 2;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlockComment = true;
      result += '  ';
      i += 2;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      inStr = true;
      strChar = c;
      result += c;
      i++;
      continue;
    }

    result += c;
    i++;
  }

  return result;
}

export type CodeScanResult =
  | { ok: true }
  | { ok: false; reason: string };

export function scanGeneratedCode(code: string): CodeScanResult {
  const masked = maskStringsLineAndBlockComments(code);
  for (const { name, re } of FORBIDDEN_PATTERNS) {
    if (re.test(masked)) {
      return { ok: false, reason: `Pattern vietato: ${name}` };
    }
  }
  for (const { name, re } of SUSPICIOUS_LOOP_PATTERNS) {
    if (re.test(masked)) {
      return { ok: false, reason: `Possibile loop infinito: ${name}` };
    }
  }
  return { ok: true };
}
