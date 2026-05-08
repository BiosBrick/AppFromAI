import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MotherApi } from '../capabilities/types';
import type { NavigatorScreen, UiNode } from '../types/uiNodes';
import { reportGenAppError } from '../debug/genAppDebug';
import { runAction, tryCompileModuleActions, type CompiledActions } from '../modules/moduleRunner';
import { renderNode, resolveTheme, type ResolvedTheme } from './components';
import { useI18n } from '../i18n/useI18n';

function collectButtonActions(node: UiNode): string[] {
  if (node.type === 'button') return node.action && !node.navigate ? [node.action] : [];
  if (node.type === 'navigator') {
    return Object.values(node.screens).flatMap((s) => {
      const childActions = s.components.flatMap((c) => collectButtonActions(c));
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

function collectInitialState(node: UiNode, acc: Record<string, unknown>) {
  switch (node.type) {
    case 'navigator':
      Object.values(node.screens).forEach((s: NavigatorScreen) =>
        s.components.forEach((c) => collectInitialState(c, acc))
      );
      break;
    case 'screen':
      node.components.forEach((c: UiNode) => collectInitialState(c, acc));
      break;
    case 'text':
      if (node.bind && node.text != null) acc[node.bind] = node.text;
      break;
    case 'input':
    case 'textarea':
      if (!(node.bind in acc)) acc[node.bind] = '';
      break;
    case 'list':
      if (!(node.bind in acc)) acc[node.bind] = [];
      break;
    case 'image':
      if (!(node.bind in acc)) acc[node.bind] = '';
      break;
    case 'card':
    case 'box':
      node.components.forEach((c: UiNode) => collectInitialState(c, acc));
      break;
    case 'audioRecorder':
      if (node.statusBind && !(node.statusBind in acc)) acc[node.statusBind] = 'Pronto';
      break;
    case 'gameView':
      if (!(node.bind in acc)) acc[node.bind] = [];
      break;
    default:
      break;
  }
}

function buildInitialState(ui: UiNode): Record<string, unknown> {
  const acc: Record<string, unknown> = {};
  collectInitialState(ui, acc);
  return acc;
}

type Props = {
  ui: UiNode;
  code: string;
  motherApi: MotherApi;
};

export function DynamicRenderer({ ui, code, motherApi }: Props) {
  const { t } = useI18n();
  const compiled = useMemo(() => tryCompileModuleActions(code), [code]);

  const compileError = useMemo(() => {
    if (!compiled.ok) return compiled.error;
    const uiActions = [...new Set(collectButtonActions(ui))];
    const missing = uiActions.filter((a) => !(a in compiled.actions));
    if (missing.length > 0) {
      return `Azioni nell'UI non trovate nel codice: ${missing.join(', ')}. Elimina il modulo e rigeneralo.`;
    }
    return null;
  }, [compiled, ui]);

  const actions: CompiledActions | null = compiled.ok ? compiled.actions : null;
  const [state, setState] = useState<Record<string, unknown>>(() => buildInitialState(ui));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Navigator state ──
  const isNavigator = ui.type === 'navigator';
  const [screenStack, setScreenStack] = useState<string[]>(() =>
    isNavigator ? [ui.initialScreen] : []
  );
  const currentScreenKey = screenStack[screenStack.length - 1] ?? '';
  const canGoBack = screenStack.length > 1;

  const onNavigate = useCallback((target: string) => {
    if (target === '__back') {
      setScreenStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    } else {
      setScreenStack((s) => [...s, target]);
    }
  }, []);

  const patchState = useCallback(
    (patch: Record<string, unknown>) => {
      const { __navigate, ...rest } = patch as Record<string, unknown> & { __navigate?: unknown };
      if (typeof __navigate === 'string') {
        onNavigate(__navigate);
      }
      if (Object.keys(rest).length > 0) {
        setState((s) => {
          const next = { ...s, ...rest };
          stateRef.current = next;
          return next;
        });
      }
    },
    [onNavigate]
  );

  const onButton = useCallback(
    async (actionName: string, input: Record<string, unknown> = {}) => {
      if (!actions) return;
      setError(null);
      setBusyAction(actionName);
      try {
        const delta = await runAction(actions, actionName, motherApi, input, stateRef.current);
        if (delta && typeof delta === 'object') patchState(delta as Record<string, unknown>);
      } catch (e) {
        setError('Azione non riuscita, riprova.');
        reportGenAppError('DynamicRenderer.action', e, { action: actionName });
      } finally {
        setBusyAction(null);
      }
    },
    [actions, motherApi, patchState]
  );

  // ── onFocus: chiama automaticamente l'action della schermata ogni volta che diventa attiva ──
  // Si scatena sia al mount iniziale sia ad ogni navigazione verso questa schermata.
  useEffect(() => {
    if (!isNavigator || ui.type !== 'navigator') return;
    if (!actions) return;
    const screen = ui.screens[currentScreenKey];
    if (!screen?.onFocus) return;
    const actionName = screen.onFocus;
    if (!(actionName in actions)) return;

    let cancelled = false;
    setBusyAction(actionName);
    runAction(actions, actionName, motherApi, {}, stateRef.current)
      .then((delta) => {
        if (cancelled) return;
        if (delta && typeof delta === 'object') patchState(delta as Record<string, unknown>);
      })
      .catch((e) => {
        if (cancelled) return;
        setError('Errore durante il caricamento della schermata.');
        reportGenAppError('DynamicRenderer.onFocus', e, { action: actionName, screen: currentScreenKey });
      })
      .finally(() => {
        if (!cancelled) setBusyAction(null);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreenKey]);

  if (compileError) {
    return (
      <View style={styles.errBox}>
        <Text style={styles.errTitle}>{t.rendererError}</Text>
        <Text style={styles.errText}>{compileError}</Text>
      </View>
    );
  }

  if (ui.type !== 'screen' && ui.type !== 'navigator') {
    return (
      <View style={styles.errBox}>
        <Text style={styles.errText}>{t.rendererRootError}</Text>
      </View>
    );
  }

  // ── Resolve theme ──
  let activeScreen: NavigatorScreen | null = null;
  let theme: ResolvedTheme;

  if (isNavigator && ui.type === 'navigator') {
    activeScreen = ui.screens[currentScreenKey] ?? null;
    const screenTheme = activeScreen?.theme ?? ui.theme;
    theme = resolveTheme(screenTheme);
  } else if (ui.type === 'screen') {
    theme = resolveTheme(ui.theme);
  } else {
    theme = resolveTheme();
  }

  const ctx = { state, setState: patchState, onButton, onNavigate, busyAction, theme, hasError: Boolean(error) };

  // ── Which node to render ──
  const nodeToRender: UiNode | null =
    isNavigator && activeScreen
      ? activeScreen
      : ui.type === 'screen'
      ? ui
      : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Back button for navigator */}
      {isNavigator && canGoBack && (
        <Pressable style={styles.backBtn} onPress={() => onNavigate('__back')}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
          <Text style={[styles.backText, { color: theme.primary }]}>{t.back}</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {nodeToRender ? renderNode(nodeToRender, ctx, isNavigator ? currentScreenKey : 'root') : null}
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 32 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d3f5c',
  },
  backText: { fontSize: 15, fontWeight: '600' },
  errBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#1a0808',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    gap: 8,
  },
  errTitle: { fontWeight: '700', color: '#f87171', marginBottom: 4 },
  errHint: {
    color: '#7a92b3',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#7f1d1d',
  },
  errText: { color: '#fca5a5', fontSize: 13 },
});
