import { ReactNode, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { UiLayoutProps, UiNode, UiStyleProps, UiTheme } from '../types/uiNodes';

export type ResolvedTheme = Required<UiTheme>;

export const DEFAULT_THEME: ResolvedTheme = {
  bg: '#0b1120',
  surface: '#1a2236',
  border: '#2d3f5c',
  primary: '#6366f1',
  text: '#e8edf5',
  muted: '#7a92b3',
};

export function resolveTheme(theme?: UiTheme): ResolvedTheme {
  if (!theme) return DEFAULT_THEME;
  return {
    bg: theme.bg ?? DEFAULT_THEME.bg,
    surface: theme.surface ?? DEFAULT_THEME.surface,
    border: theme.border ?? DEFAULT_THEME.border,
    primary: theme.primary ?? DEFAULT_THEME.primary,
    text: theme.text ?? DEFAULT_THEME.text,
    muted: theme.muted ?? DEFAULT_THEME.muted,
  };
}

function layoutToViewStyle(layout?: UiLayoutProps): ViewStyle {
  if (!layout) return {};
  const s: ViewStyle = {};
  if (layout.flex != null) s.flex = layout.flex;
  if (layout.flexGrow != null) s.flexGrow = layout.flexGrow;
  if (layout.flexShrink != null) s.flexShrink = layout.flexShrink;
  if (layout.width != null) s.width = layout.width as ViewStyle['width'];
  if (layout.minWidth != null) s.minWidth = layout.minWidth;
  if (layout.maxWidth != null) s.maxWidth = layout.maxWidth as ViewStyle['maxWidth'];
  if (layout.alignSelf != null) s.alignSelf = layout.alignSelf;
  if (layout.marginTop != null) s.marginTop = layout.marginTop;
  if (layout.marginBottom != null) s.marginBottom = layout.marginBottom;
  if (layout.marginLeft != null) s.marginLeft = layout.marginLeft;
  if (layout.marginRight != null) s.marginRight = layout.marginRight;
  if (layout.marginHorizontal != null) {
    s.marginLeft = layout.marginHorizontal;
    s.marginRight = layout.marginHorizontal;
  }
  if (layout.marginVertical != null) {
    s.marginTop = layout.marginVertical;
    s.marginBottom = layout.marginVertical;
  }
  return s;
}

function layoutToTextStyle(layout?: UiLayoutProps): TextStyle {
  const s: TextStyle = { ...layoutToViewStyle(layout) };
  if (layout?.textAlign != null) s.textAlign = layout.textAlign;
  return s;
}

function applyStyle(base: ViewStyle, style?: UiStyleProps): ViewStyle {
  if (!style) return base;
  const s: ViewStyle = { ...base };
  if (style.backgroundColor != null) s.backgroundColor = style.backgroundColor;
  if (style.borderRadius != null) s.borderRadius = style.borderRadius;
  if (style.padding != null) s.padding = style.padding;
  if (style.borderColor != null) s.borderColor = style.borderColor;
  if (style.borderWidth != null) s.borderWidth = style.borderWidth;
  if (style.opacity != null) s.opacity = style.opacity;
  return s;
}

function applyTextStyle(base: TextStyle, style?: UiStyleProps): TextStyle {
  if (!style) return base;
  const s: TextStyle = { ...base };
  if (style.color != null) s.color = style.color;
  if (style.fontSize != null) s.fontSize = style.fontSize;
  if (style.fontWeight != null) s.fontWeight = style.fontWeight as TextStyle['fontWeight'];
  if (style.opacity != null) s.opacity = style.opacity;
  return s;
}

export type RenderCtx = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
  onButton: (action: string, input?: Record<string, unknown>) => Promise<void>;
  onNavigate: (screen: string) => void;
  busyAction: string | null;
  theme: ResolvedTheme;
  hasError: boolean;
};

function getBound(state: Record<string, unknown>, key: string): string {
  const v = state[key];
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gamepad — tasti fisici sullo schermo con supporto hold
// ─────────────────────────────────────────────────────────────────────────────

type GamepadBtnDef = Extract<UiNode, { type: 'gamepad' }>['buttons'][number];

function GamepadButton({
  btn,
  size,
  onAction,
  theme,
}: {
  btn: GamepadBtnDef;
  size: number;
  onAction: (action: string) => void;
  theme: ResolvedTheme;
}) {
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onButtonRef = useRef(onAction);
  onButtonRef.current = onAction;

  const startPress = () => {
    if (!btn.action) return;
    onButtonRef.current(btn.action);
    if (btn.hold) {
      const ms = Math.max(16, btn.holdMs ?? 80);
      holdRef.current = setInterval(() => onButtonRef.current(btn.action), ms);
    }
  };

  const endPress = () => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  };

  // useEffect cleanup al dismount
  useEffect(() => () => endPress(), []);

  const bg = btn.style?.backgroundColor ?? theme.surface;
  const fg = btn.style?.color ?? theme.text;
  const isEmpty = !btn.action && (!btn.label || btn.label.trim() === '');

  if (isEmpty) {
    return <View style={{ width: size, height: size }} />;
  }

  return (
    <Pressable
      onPressIn={startPress}
      onPressOut={endPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: pressed ? theme.primary : bg,
        borderWidth: 1.5,
        borderColor: pressed ? theme.primary : theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        ...(btn.style?.borderRadius != null ? { borderRadius: btn.style.borderRadius } : {}),
      })}
    >
      <Text
        style={{
          color: fg,
          fontSize: btn.style?.fontSize ?? Math.round(size * 0.38),
          fontWeight: (btn.style?.fontWeight as TextStyle['fontWeight']) ?? '700',
          userSelect: 'none',
        } as TextStyle}
      >
        {btn.label}
      </Text>
    </Pressable>
  );
}

function GamepadNode({
  node,
  ctx,
  nodeKey,
}: {
  node: Extract<UiNode, { type: 'gamepad' }>;
  ctx: RenderCtx;
  nodeKey: string;
}) {
  const size = node.buttonSize ?? 64;
  const gap = Math.round(size * 0.15);
  const dir = node.direction ?? 'row';
  const t = ctx.theme;

  const onAction = (action: string) => {
    if (action) void ctx.onButton(action, {});
  };

  // ── Row layout ──
  if (dir === 'row') {
    return (
      <View
        key={nodeKey}
        style={[{
          flexDirection: 'row',
          gap,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: gap,
        }, layoutToViewStyle(node.layout)]}
      >
        {node.buttons.map((btn) => (
          <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} />
        ))}
      </View>
    );
  }

  // ── Split layout: metà sinistra + metà destra ──
  if (dir === 'split') {
    const mid = Math.ceil(node.buttons.length / 2);
    const leftBtns = node.buttons.slice(0, mid);
    const rightBtns = node.buttons.slice(mid);
    return (
      <View
        key={nodeKey}
        style={[{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: gap * 2,
          paddingVertical: gap,
        }, layoutToViewStyle(node.layout)]}
      >
        <View style={{ flexDirection: 'row', gap }}>
          {leftBtns.map((btn) => (
            <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap }}>
          {rightBtns.map((btn) => (
            <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} />
          ))}
        </View>
      </View>
    );
  }

  // ── DPad layout: croce direzionale ──
  // Primi 4 button → posizioni [su, sinistra, destra, giù]. Extra → riga a destra.
  if (dir === 'dpad') {
    const [upBtn, leftBtn, rightBtn, downBtn] = node.buttons;
    const extraBtns = node.buttons.slice(4);
    const emptySlot = { id: '__empty', label: '', action: '', hold: false } as GamepadBtnDef;

    return (
      <View
        key={nodeKey}
        style={[{
          flexDirection: 'row',
          gap: gap * 2,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: gap,
        }, layoutToViewStyle(node.layout)]}
      >
        {/* D-pad cross */}
        <View style={{ alignItems: 'center', gap }}>
          {/* Top row: empty | up | empty */}
          <View style={{ flexDirection: 'row', gap }}>
            <View style={{ width: size, height: size }} />
            <GamepadButton key={(upBtn ?? emptySlot).id} btn={upBtn ?? emptySlot} size={size} onAction={onAction} theme={t} />
            <View style={{ width: size, height: size }} />
          </View>
          {/* Middle row: left | empty | right */}
          <View style={{ flexDirection: 'row', gap }}>
            <GamepadButton key={(leftBtn ?? emptySlot).id} btn={leftBtn ?? emptySlot} size={size} onAction={onAction} theme={t} />
            <View style={{ width: size, height: size }} />
            <GamepadButton key={(rightBtn ?? emptySlot).id} btn={rightBtn ?? emptySlot} size={size} onAction={onAction} theme={t} />
          </View>
          {/* Bottom row: empty | down | empty */}
          <View style={{ flexDirection: 'row', gap }}>
            <View style={{ width: size, height: size }} />
            <GamepadButton key={(downBtn ?? emptySlot).id} btn={downBtn ?? emptySlot} size={size} onAction={onAction} theme={t} />
            <View style={{ width: size, height: size }} />
          </View>
        </View>

        {/* Extra buttons (es. A, B, Start) in colonna */}
        {extraBtns.length > 0 && (
          <View style={{ gap }}>
            {extraBtns.map((btn) => (
              <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} />
            ))}
          </View>
        )}
      </View>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GameView — canvas dichiarativa + game loop ticker + tap input
// ─────────────────────────────────────────────────────────────────────────────

type SceneRect   = { type: 'rect';   x: number; y: number; w: number; h: number; color?: string; radius?: number };
type SceneCircle = { type: 'circle'; x: number; y: number; r: number; color?: string };
type SceneText   = { type: 'text';   x: number; y: number; text: string; color?: string; fontSize?: number; fontWeight?: string; align?: 'left' | 'center' | 'right' };
type SceneObj    = SceneRect | SceneCircle | SceneText;

function renderSceneObj(raw: unknown, i: number): ReactNode {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const t = String(o.type ?? '');

  if (t === 'rect') {
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left:   Number(o.x ?? 0),
          top:    Number(o.y ?? 0),
          width:  Number(o.w ?? 10),
          height: Number(o.h ?? 10),
          backgroundColor: String(o.color ?? '#ffffff'),
          borderRadius: Number(o.radius ?? 0),
        }}
      />
    );
  }

  if (t === 'circle') {
    const r = Number(o.r ?? 10);
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: Number(o.x ?? 0) - r,
          top:  Number(o.y ?? 0) - r,
          width:  r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: String(o.color ?? '#ffffff'),
        }}
      />
    );
  }

  if (t === 'text') {
    return (
      <Text
        key={i}
        style={{
          position: 'absolute',
          left:     Number(o.x ?? 0),
          top:      Number(o.y ?? 0),
          color:    String(o.color ?? '#ffffff'),
          fontSize: Number(o.fontSize ?? 14),
          fontWeight: (String(o.fontWeight ?? '400')) as TextStyle['fontWeight'],
          textAlign: (['left','center','right'].includes(String(o.align ?? '')) ? String(o.align) : 'left') as 'left'|'center'|'right',
        }}
      >
        {String(o.text ?? '')}
      </Text>
    );
  }

  return null;
}

function buildFallbackScene(w: number, h: number, hasTick: boolean): SceneObj[] {
  return [
    { type: 'rect', x: 0, y: 0, w, h, color: '#101827', radius: 12 },
    { type: 'rect', x: 10, y: 10, w: w - 20, h: h - 20, color: '#17233a', radius: 10 },
    { type: 'circle', x: Math.round(w * 0.5), y: Math.round(h * 0.42), r: 28, color: '#6366f1' },
    {
      type: 'text',
      x: 20,
      y: Math.round(h * 0.58),
      text: hasTick ? 'Avvio gioco...' : 'Gioco non inizializzato',
      color: '#e8edf5',
      fontSize: 18,
      fontWeight: '800',
    },
    {
      type: 'text',
      x: 20,
      y: Math.round(h * 0.58) + 30,
      text: hasTick ? 'Tocca lo schermo per giocare' : 'Rigenera il modulo con gameView + onTick',
      color: '#7a92b3',
      fontSize: 13,
      fontWeight: '600',
    },
  ];
}

// Suppress unused-type warnings for the scene type aliases above.
void (0 as unknown as SceneObj);

function GameViewNode({
  node,
  ctx,
  nodeKey,
}: {
  node: Extract<UiNode, { type: 'gameView' }>;
  ctx: RenderCtx;
  nodeKey: string;
}) {
  // Usa un ref per onButton così il ticker non ri-crea l'interval ad ogni render.
  const onButtonRef = useRef(ctx.onButton);
  onButtonRef.current = ctx.onButton;
  const tickBusyRef = useRef(false);

  useEffect(() => {
    if (ctx.hasError) return;
    if (!node.tickAction || !node.tickMs) return;
    const ms = Math.max(16, node.tickMs);
    const runTick = () => {
      if (tickBusyRef.current) return;   // salta tick se il precedente è ancora in volo
      tickBusyRef.current = true;
      onButtonRef.current(node.tickAction!, {}).finally(() => {
        tickBusyRef.current = false;
      });
    };
    runTick();
    const id = setInterval(runTick, ms);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.hasError, node.tickAction, node.tickMs]);

  const gw = node.width  ?? 320;
  const gh = node.height ?? 300;

  const rawScene = ctx.state[node.bind];
  const scene: unknown[] =
    Array.isArray(rawScene) && rawScene.length > 0
      ? rawScene
      : buildFallbackScene(gw, gh, Boolean(node.tickAction));

  const canvas = (
    <View
      style={{
        width: gw,
        height: gh,
        backgroundColor: '#101827',
        overflow: 'hidden',
        borderRadius: 12,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: '#2d3f5c',
        ...layoutToViewStyle(node.layout),
      }}
    >
      {scene.map((obj, i) => renderSceneObj(obj, i))}
      {ctx.hasError ? (
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            padding: 10,
            borderRadius: 10,
            backgroundColor: 'rgba(127, 29, 29, 0.86)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
            Il gioco si e' fermato. Controlla l'errore sotto e rigenera il modulo.
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (node.onTapAction) {
    return (
      <Pressable
        key={nodeKey}
        onPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          void onButtonRef.current(node.onTapAction!, {
            x: Math.round(locationX),
            y: Math.round(locationY),
            jump: -8,
          });
        }}
      >
        {canvas}
      </Pressable>
    );
  }

  return <View key={nodeKey}>{canvas}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────

export function renderNode(node: UiNode, ctx: RenderCtx, keyPrefix: string): ReactNode {
  const key = `${keyPrefix}-${'id' in node && node.id ? node.id : node.type}`;
  const t = ctx.theme;

  switch (node.type) {
    case 'navigator':
      // Handled by DynamicRenderer — should not reach here.
      return null;

    case 'screen':
      return (
        <View
          key={key}
          style={[
            { flex: 1, gap: 14, paddingVertical: 8 },
            node.gap != null ? { gap: node.gap } : null,
            node.padding != null ? { padding: node.padding } : null,
          ]}
        >
          <Text style={{ fontSize: 22, fontWeight: '800', color: t.text, marginBottom: 4, letterSpacing: -0.4 }}>
            {node.title}
          </Text>
          {node.components.map((c: UiNode, i: number) => renderNode(c, ctx, `${key}-${i}`))}
        </View>
      );

    case 'text': {
      const content = node.bind != null ? getBound(ctx.state, node.bind) : (node.text ?? '');
      return (
        <Text
          key={key}
          style={applyTextStyle({ fontSize: 16, color: t.text, ...layoutToTextStyle(node.layout) }, node.style)}
        >
          {content}
        </Text>
      );
    }

    case 'input':
      return (
        <TextInput
          key={key}
          style={[
            applyStyle(
              {
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: t.surface,
              },
              node.style
            ),
            applyTextStyle({ color: t.text, fontSize: 16 }, node.style),
            layoutToTextStyle(node.layout),
          ]}
          placeholder={node.placeholder}
          placeholderTextColor={t.muted}
          keyboardType={
            node.keyboardType === 'numeric'
              ? 'numeric'
              : node.keyboardType === 'decimal-pad'
              ? 'decimal-pad'
              : 'default'
          }
          value={getBound(ctx.state, node.bind)}
          onChangeText={(v) => ctx.setState({ [node.bind]: v })}
        />
      );

    case 'textarea':
      return (
        <TextInput
          key={key}
          style={[
            applyStyle(
              {
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                minHeight: 100,
                backgroundColor: t.surface,
              },
              node.style
            ),
            applyTextStyle({ color: t.text, fontSize: 16 }, node.style),
            layoutToTextStyle(node.layout),
            { textAlignVertical: 'top' },
          ]}
          placeholder={node.placeholder}
          placeholderTextColor={t.muted}
          multiline
          value={getBound(ctx.state, node.bind)}
          onChangeText={(v) => ctx.setState({ [node.bind]: v })}
        />
      );

    case 'button': {
      const actionName = node.action ?? '';
      const busy = actionName ? ctx.busyAction === actionName : false;
      const variant = node.variant ?? 'primary';

      const baseBg =
        variant === 'danger'
          ? '#7f1d1d'
          : variant === 'secondary'
          ? t.surface
          : t.primary;

      const btnStyle = applyStyle(
        {
          backgroundColor: baseBg,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          ...(variant === 'secondary'
            ? { borderWidth: 1, borderColor: t.border }
            : variant === 'danger'
            ? { borderWidth: 1, borderColor: '#991b1b' }
            : {}),
          ...layoutToViewStyle(node.layout),
        },
        node.style
      );

      const btnTextStyle = applyTextStyle(
        { color: '#fff', fontWeight: '700', fontSize: 16 },
        node.style
      );

      const onPress = () => {
        console.log('[Button] pressed', { id: node.id, navigate: node.navigate, action: actionName });
        if (node.navigate) {
          console.log('[Button] calling onNavigate →', node.navigate);
          ctx.onNavigate(node.navigate);
        } else if (actionName) {
          console.log('[Button] calling onButton →', actionName);
          void ctx.onButton(actionName, node.actionInput ?? {});
        } else {
          console.log('[Button] no navigate and no action — nothing to do');
        }
      };

      return (
        <Pressable
          key={key}
          style={({ pressed }) => [btnStyle, pressed && { opacity: 0.8 }]}
          disabled={busy}
          onPress={onPress}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={btnTextStyle}>{node.text}</Text>
          )}
        </Pressable>
      );
    }

    case 'list': {
      const raw = ctx.state[node.bind];
      const items = Array.isArray(raw) ? (raw as unknown[]) : [];
      return (
        <FlatList
          key={key}
          style={layoutToViewStyle(node.layout)}
          data={items}
          keyExtractor={(_, i) => `${key}-row-${i}`}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={{ color: t.muted, fontSize: 14 }}>{node.emptyText ?? 'Nessun elemento'}</Text>
          }
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }}>
              <Text style={{ color: t.text }}>{typeof item === 'string' ? item : JSON.stringify(item)}</Text>
            </View>
          )}
        />
      );
    }

    case 'box': {
      const dir = node.direction ?? 'column';
      const boxStyle: ViewStyle = {
        flexDirection: dir === 'row' ? 'row' : 'column',
        flexWrap: node.wrap ? 'wrap' : 'nowrap',
        ...layoutToViewStyle(node.layout),
      };
      if (node.gap != null) boxStyle.gap = node.gap;
      if (node.padding != null) boxStyle.padding = node.padding;
      if (node.alignItems != null) boxStyle.alignItems = node.alignItems;
      if (node.justifyContent != null) boxStyle.justifyContent = node.justifyContent;
      return (
        <View key={key} style={boxStyle}>
          {node.components.map((c: UiNode, i: number) => renderNode(c, ctx, `${key}-b-${i}`))}
        </View>
      );
    }

    case 'card':
      return (
        <View
          key={key}
          style={[
            applyStyle(
              {
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 14,
                padding: 14,
                marginVertical: 4,
                backgroundColor: t.surface,
              },
              node.style
            ),
            layoutToViewStyle(node.layout),
            { gap: 10 },
          ]}
        >
          {node.components.map((c: UiNode, i: number) => renderNode(c, ctx, `${key}-c-${i}`))}
        </View>
      );

    case 'image': {
      const uri = getBound(ctx.state, node.bind);
      if (!uri) return <Text key={key} style={{ color: t.muted, fontSize: 14 }}>Nessuna immagine</Text>;
      return (
        <Image
          key={key}
          source={{ uri }}
          style={[
            { height: node.height ?? 180, width: '100%', borderRadius: 10 },
            layoutToViewStyle(node.layout) as ImageStyle,
          ]}
          resizeMode="cover"
        />
      );
    }

    case 'audioRecorder': {
      const status =
        node.statusBind != null
          ? getBound(ctx.state, node.statusBind)
          : 'Usa i pulsanti del modulo per registrare.';
      return (
        <View key={key} style={[{ borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 14, gap: 10, marginVertical: 4, backgroundColor: t.surface }, layoutToViewStyle(node.layout)]}>
          <Text style={{ color: t.muted }}>🎙️ Registratore audio</Text>
          <Text style={{ color: t.text }}>{status}</Text>
        </View>
      );
    }

    case 'qrScanner':
      return (
        <View key={key} style={[{ borderWidth: 1, borderColor: t.border, borderRadius: 14, padding: 14, gap: 10, marginVertical: 4, backgroundColor: t.surface }, layoutToViewStyle(node.layout)]}>
          <Text style={{ color: t.muted }}>
            📷 {node.hint ?? 'Avvia scansione da un pulsante collegato a api.qrScanner.scan()'}
          </Text>
        </View>
      );

    case 'gameView':
      return <GameViewNode key={key} node={node} ctx={ctx} nodeKey={key} />;

    case 'gamepad':
      return <GamepadNode key={key} node={node} ctx={ctx} nodeKey={key} />;

    default:
      return null;
  }
}
