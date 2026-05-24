import { ReactNode, useEffect, useMemo, useRef, useCallback } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
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
import {
  Canvas,
  Rect as SkRect,
  RoundedRect as SkRoundedRect,
  Circle as SkCircle,
  Oval as SkOval,
  Line as SkLine,
  Path as SkPath,
  Fill as SkFill,
  Group as SkGroup,
  Text as SkText,
  matchFont,
  LinearGradient as SkLinearGradient,
  RadialGradient as SkRadialGradient,
  BlurMask,
  Shadow,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
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
  /** Codice raw del modulo webGame (browser JS con canvas 2D) */
  webgameCode?: string;
  /** Enables browser-side network APIs for webGame only after app-level permission checks. */
  webGameAllowNetwork?: boolean;
  /** Ref al WebView per inviare eventi gamepad */
  webViewRef?: React.RefObject<WebView | null>;
};

function getBound(state: Record<string, unknown>, key: string): string {
  const v = state[key];
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length > 0 ? `(${v.length})` : '';
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // Prova a estrarre un campo leggibile
    const primary = obj.name ?? obj.title ?? obj.label ?? obj.text ?? obj.description;
    if (primary != null) return String(primary);
    // Fallback: mostra coppie chiave: valore senza id
    return Object.entries(obj)
      .filter(([k, val]) => k !== 'id' && val !== null && val !== undefined && val !== '')
      .map(([k, val]) => `${k}: ${String(val)}`)
      .join(' · ');
  }
  return String(v);
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
  webViewRef,
}: {
  btn: GamepadBtnDef;
  size: number;
  onAction: (action: string) => void;
  theme: ResolvedTheme;
  webViewRef?: React.RefObject<WebView | null>;
}) {
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onButtonRef = useRef(onAction);
  onButtonRef.current = onAction;

  const sendWebBtn = (id: string, pressed: boolean) => {
    // Use postMessage (reliable on Android) instead of injectJavaScript
    webViewRef?.current?.postMessage(JSON.stringify({ type: 'btn', id, on: pressed }));
  };

  const startPress = () => {
    if (!btn.action) return;
    if (webViewRef) {
      // WebGame mode: send button events directly to WebView
      sendWebBtn(btn.action, true);
      if (btn.hold) {
        const ms = Math.max(16, btn.holdMs ?? 80);
        holdRef.current = setInterval(() => sendWebBtn(btn.action, true), ms);
      }
    } else {
      // Normal sandbox mode
      onButtonRef.current(btn.action);
      if (btn.hold) {
        const ms = Math.max(16, btn.holdMs ?? 80);
        holdRef.current = setInterval(() => onButtonRef.current(btn.action), ms);
      }
    }
  };

  const endPress = () => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
    if (webViewRef && btn.action) {
      sendWebBtn(btn.action, false);
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
  const wvRef = ctx.webViewRef;

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
          <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
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
            <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap }}>
          {rightBtns.map((btn) => (
            <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
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
            <GamepadButton key={(upBtn ?? emptySlot).id} btn={upBtn ?? emptySlot} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
            <View style={{ width: size, height: size }} />
          </View>
          {/* Middle row: left | empty | right */}
          <View style={{ flexDirection: 'row', gap }}>
            <GamepadButton key={(leftBtn ?? emptySlot).id} btn={leftBtn ?? emptySlot} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
            <View style={{ width: size, height: size }} />
            <GamepadButton key={(rightBtn ?? emptySlot).id} btn={rightBtn ?? emptySlot} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
          </View>
          {/* Bottom row: empty | down | empty */}
          <View style={{ flexDirection: 'row', gap }}>
            <View style={{ width: size, height: size }} />
            <GamepadButton key={(downBtn ?? emptySlot).id} btn={downBtn ?? emptySlot} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
            <View style={{ width: size, height: size }} />
          </View>
        </View>

        {/* Extra buttons (es. A, B, Start) in colonna */}
        {extraBtns.length > 0 && (
          <View style={{ gap }}>
            {extraBtns.map((btn) => (
              <GamepadButton key={btn.id} btn={btn} size={size} onAction={onAction} theme={t} webViewRef={wvRef} />
            ))}
          </View>
        )}
      </View>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GameView 3.0 — Skia GPU-powered 2D game engine
//
// Scene object types:
//   rect, roundedRect, circle, oval, line, path, text, group, tilemap
//   Effects: glow, shadow, gradient (on rect/circle/oval)
//   Special: { type:'camera', x, y }
// ─────────────────────────────────────────────────────────────────────────────

function n(v: unknown, def = 0): number { return isFinite(Number(v)) ? Number(v) : def; }
function s(v: unknown, def = ''): string { return v != null ? String(v) : def; }
function op(v: unknown): number { const x = Number(v ?? 1); return isFinite(x) ? Math.max(0, Math.min(1, x)) : 1; }

// Font cache — matchFont per size
const _fontCache = new Map<string, SkFont | null>();
function getFont(size: number, bold = false): SkFont | null {
  const key = `${size}-${bold}`;
  if (_fontCache.has(key)) return _fontCache.get(key)!;
  try {
    const font = matchFont({
      fontFamily: 'Helvetica',
      fontSize: size,
      fontWeight: bold ? 'bold' : 'normal',
    });
    _fontCache.set(key, font ?? null);
    return font ?? null;
  } catch {
    _fontCache.set(key, null);
    return null;
  }
}

// Parse gradient: color can be '#f00' or ['#f00','#00f'] or ['#f00','#0f0','#00f']
function isGradient(color: unknown): color is string[] {
  return Array.isArray(color) && color.length >= 2;
}

function renderSkiaObj(raw: unknown, key: string): ReactNode {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const t = s(o.type);

  // ── Effetti opzionali ──────────────────────────────────────────────────────
  const glowRadius = n(o.glow, 0);
  const shadowArr = Array.isArray(o.shadow) ? o.shadow as unknown[] : null;
  const opacity = op(o.opacity);
  const rotation = n(o.rotation, 0);

  const effects: ReactNode[] = [];
  if (glowRadius > 0) {
    effects.push(<BlurMask key="glow" blur={glowRadius} style="outer" />);
  }
  if (shadowArr && shadowArr.length >= 3) {
    effects.push(<Shadow key="shad" dx={n(shadowArr[0])} dy={n(shadowArr[1])} blur={n(shadowArr[2])} color={s(shadowArr[3], '#000')} />);
  }

  // ── rect ──────────────────────────────────────────────────────────────────
  if (t === 'rect') {
    const x = n(o.x); const y = n(o.y);
    const w = Math.max(1, n(o.w, 10)); const h = Math.max(1, n(o.h, 10));
    const r = n(o.radius, 0);
    const transform = rotation !== 0
      ? [{ translateX: x + w/2 }, { translateY: y + h/2 }, { rotate: rotation * Math.PI / 180 }, { translateX: -(x + w/2) }, { translateY: -(y + h/2) }]
      : undefined;

    const shape = r > 0
      ? <SkRoundedRect key={key} x={x} y={y} width={w} height={h} r={r} color={isGradient(o.color) ? 'transparent' : s(o.color, '#fff')} opacity={opacity} transform={transform}>{effects}</SkRoundedRect>
      : <SkRect key={key} x={x} y={y} width={w} height={h} color={isGradient(o.color) ? 'transparent' : s(o.color, '#fff')} opacity={opacity} transform={transform}>{effects}</SkRect>;

    if (isGradient(o.color)) {
      const angle = n(o.gradientAngle, 180); // 0=left-right, 90=top-bottom, 180=bottom-top
      const rad = angle * Math.PI / 180;
      const cx = x + w / 2; const cy = y + h / 2;
      const dx = Math.sin(rad) * w / 2; const dy = Math.cos(rad) * h / 2;
      return (
        <SkGroup key={key} opacity={opacity} transform={transform}>
          {r > 0
            ? <SkRoundedRect x={x} y={y} width={w} height={h} r={r} color="white">{effects}</SkRoundedRect>
            : <SkRect x={x} y={y} width={w} height={h} color="white">{effects}</SkRect>
          }
          {r > 0
            ? <SkRoundedRect x={x} y={y} width={w} height={h} r={r} color="transparent">
                <SkLinearGradient start={vec(cx - dx, cy - dy)} end={vec(cx + dx, cy + dy)} colors={o.color as string[]} />
              </SkRoundedRect>
            : <SkRect x={x} y={y} width={w} height={h} color="transparent">
                <SkLinearGradient start={vec(cx - dx, cy - dy)} end={vec(cx + dx, cy + dy)} colors={o.color as string[]} />
              </SkRect>
          }
        </SkGroup>
      );
    }
    return shape;
  }

  // ── circle ─────────────────────────────────────────────────────────────────
  if (t === 'circle') {
    const cx = n(o.x); const cy = n(o.y); const r = Math.max(1, n(o.r, 10));
    if (isGradient(o.color)) {
      return (
        <SkGroup key={key} opacity={opacity}>
          <SkCircle cx={cx} cy={cy} r={r} color="transparent">
            <SkRadialGradient c={vec(cx, cy)} r={r} colors={o.color as string[]} />
            {effects}
          </SkCircle>
        </SkGroup>
      );
    }
    return <SkCircle key={key} cx={cx} cy={cy} r={r} color={s(o.color, '#fff')} opacity={opacity}>{effects}</SkCircle>;
  }

  // ── oval ───────────────────────────────────────────────────────────────────
  if (t === 'oval' || t === 'ellipse') {
    const cx = n(o.cx ?? o.x); const cy = n(o.cy ?? o.y);
    const rx = Math.max(1, n(o.rx, 20)); const ry = Math.max(1, n(o.ry, 10));
    return (
      <SkOval key={key} rect={{ x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }}
        color={s(o.color, '#fff')} opacity={opacity}>
        {effects}
      </SkOval>
    );
  }

  // ── line ───────────────────────────────────────────────────────────────────
  if (t === 'line') {
    return (
      <SkLine key={key}
        p1={vec(n(o.x1), n(o.y1))} p2={vec(n(o.x2), n(o.y2))}
        color={s(o.color, '#fff')} strokeWidth={Math.max(0.5, n(o.width, 2))}
        style="stroke"
        opacity={opacity}>
        {glowRadius > 0 ? <BlurMask blur={glowRadius} style="outer" /> : null}
      </SkLine>
    );
  }

  // ── path ───────────────────────────────────────────────────────────────────
  if (t === 'path') {
    const pathStr = s(o.d);
    if (!pathStr) return null;
    try {
      return (
        <SkPath key={key}
          path={pathStr}
          color={s(o.color ?? o.stroke, '#fff')}
          style={o.fill && o.fill !== 'none' ? 'fill' : 'stroke'}
          strokeWidth={n(o.strokeWidth, 2)}
          opacity={opacity}>
          {effects}
        </SkPath>
      );
    } catch { return null; }
  }

  // ── text ───────────────────────────────────────────────────────────────────
  if (t === 'text') {
    const fontSize = Math.max(8, n(o.fontSize, 14));
    const bold = s(o.fontWeight, '400') === '700' || s(o.fontWeight) === 'bold' || n(o.fontWeight) >= 700;
    const font = getFont(fontSize, bold);
    if (!font) return null;
    const txt = s(o.text);
    let tx = n(o.x);
    const align = s(o.align, 'left');
    if (align === 'center' || align === 'right') {
      try {
        const w = font.measureText(txt).width;
        if (align === 'center') tx -= w / 2;
        else tx -= w;
      } catch { /* ignore */ }
    }
    return (
      <SkGroup key={key} opacity={opacity}>
        {glowRadius > 0
          ? <SkText x={tx} y={n(o.y)} text={txt} font={font} color={s(o.color, '#fff')}>
              <BlurMask blur={glowRadius} style="outer" />
            </SkText>
          : null}
        <SkText x={tx} y={n(o.y)} text={txt} font={font} color={s(o.color, '#fff')} />
      </SkGroup>
    );
  }

  // ── group ──────────────────────────────────────────────────────────────────
  if (t === 'group') {
    const children = Array.isArray(o.children) ? o.children : [];
    const gx = n(o.x); const gy = n(o.y);
    const rot = n(o.rotation, 0);
    const sx = isFinite(Number(o.scaleX)) ? Number(o.scaleX) : 1;
    const sy = isFinite(Number(o.scaleY)) ? Number(o.scaleY) : 1;
    const transform: Parameters<typeof SkGroup>[0]['transform'] = [];
    if (gx !== 0 || gy !== 0) transform.push({ translateX: gx }, { translateY: gy });
    if (rot !== 0) transform.push({ rotate: rot * Math.PI / 180 });
    if (sx !== 1) transform.push({ scaleX: sx });
    if (sy !== 1) transform.push({ scaleY: sy });
    return (
      <SkGroup key={key} transform={transform} opacity={opacity}>
        {children.map((c, ci) => renderSkiaObj(c, `${key}-${ci}`))}
      </SkGroup>
    );
  }

  // ── tilemap ────────────────────────────────────────────────────────────────
  if (t === 'tilemap') {
    const rows = Array.isArray(o.tiles) ? o.tiles as number[][] : [];
    const palette = Array.isArray(o.palette) ? o.palette as string[] : [];
    const ts = Math.max(1, n(o.tileSize, 16));
    const ox = n(o.x, 0); const oy = n(o.y, 0);
    const tiles: ReactNode[] = [];
    rows.forEach((row, ri) => {
      if (!Array.isArray(row)) return;
      row.forEach((cell, ci) => {
        if (!cell || cell === 0) return;
        const color = palette[cell - 1] ?? '#888888';
        tiles.push(
          <SkRect key={`${key}-${ri}-${ci}`}
            x={ox + ci * ts} y={oy + ri * ts}
            width={ts} height={ts}
            color={color}
          />
        );
      });
    });
    return <SkGroup key={key}>{tiles}</SkGroup>;
  }

  return null;
}

function buildFallbackScene(w: number, h: number, hasTick: boolean): unknown[] {
  return [
    { type: 'rect', x: 0, y: 0, w, h, color: ['#0f172a', '#1e293b'], gradientAngle: 90 },
    { type: 'circle', x: w * 0.5, y: h * 0.38, r: 32, color: '#6366f1', glow: 20 },
    { type: 'text', x: w * 0.5, y: h * 0.57, text: hasTick ? 'Starting...' : 'Not initialized', color: '#e8edf5', fontSize: 18, fontWeight: '700', align: 'center' },
    { type: 'text', x: w * 0.5, y: h * 0.57 + 28, text: hasTick ? 'Tap to play' : 'Add gameView + onTick', color: '#7a92b3', fontSize: 13, align: 'center' },
  ];
}

function GameViewNode({
  node,
  ctx,
  nodeKey,
}: {
  node: Extract<UiNode, { type: 'gameView' }>;
  ctx: RenderCtx;
  nodeKey: string;
}) {
  const onButtonRef = useRef(ctx.onButton);
  onButtonRef.current = ctx.onButton;
  const tickBusyRef = useRef(false);
  const lastTickRef = useRef(Date.now());

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ctx.hasError) return;
    if (!node.tickAction || !node.tickMs) return;
    const ms = Math.max(16, node.tickMs);

    const runTick = () => {
      if (tickBusyRef.current) return;
      tickBusyRef.current = true;
      const now = Date.now();
      const dt = Math.min((now - lastTickRef.current) / 1000, 0.1); // delta in secondi, max 100ms
      lastTickRef.current = now;
      onButtonRef.current(node.tickAction!, { dt, dtMs: Math.round(dt * 1000) }).finally(() => {
        tickBusyRef.current = false;
      });
    };

    runTick();
    const id = setInterval(runTick, ms);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.hasError, node.tickAction, node.tickMs]);

  const gw = node.width  ?? 320;
  const gh = node.height ?? 480;

  const rawScene = ctx.state[node.bind];

  // ── Estrai camera dalla scena se presente ─────────────────────────────────
  let camX = 0;
  let camY = 0;
  let sceneObjs: unknown[] = [];

  if (Array.isArray(rawScene) && rawScene.length > 0) {
    for (const obj of rawScene) {
      if (obj && typeof obj === 'object' && (obj as Record<string,unknown>).type === 'camera') {
        const c = obj as Record<string, unknown>;
        camX = isFinite(Number(c.x)) ? Number(c.x) : 0;
        camY = isFinite(Number(c.y)) ? Number(c.y) : 0;
      } else {
        sceneObjs.push(obj);
      }
    }
  } else {
    sceneObjs = buildFallbackScene(gw, gh, Boolean(node.tickAction));
  }

  // ── Raccolta di swipe ─────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
      {/* Skia GPU canvas — pointerEvents none so touches reach the parent Pressable */}
      <Canvas style={{ width: gw, height: gh, position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <SkGroup transform={camX !== 0 || camY !== 0 ? [{ translateX: -camX }, { translateY: -camY }] : undefined}>
          {sceneObjs.map((obj, i) => renderSkiaObj(obj, String(i)))}
        </SkGroup>
      </Canvas>

      {/* Error overlay */}
      {ctx.hasError ? (
        <View style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          padding: 10, borderRadius: 10,
          backgroundColor: 'rgba(127,29,29,0.9)',
        }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>
            Game stopped. Check error and regenerate.
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (node.onTapAction || node.onSwipeAction) {
    return (
      <Pressable
        key={nodeKey}
        onPress={(e) => {
          if (!node.onTapAction) return;
          const { locationX, locationY } = e.nativeEvent;
          void onButtonRef.current(node.onTapAction, {
            x: Math.round(locationX + camX),
            y: Math.round(locationY + camY),
            jump: -8,
          });
        }}
        onTouchStart={(e) => {
          const t = e.nativeEvent.touches[0];
          if (t) touchStartRef.current = { x: t.locationX, y: t.locationY };
        }}
        onTouchEnd={(e) => {
          if (!node.onSwipeAction || !touchStartRef.current) return;
          const t = e.nativeEvent.changedTouches[0];
          if (!t) return;
          const dx = t.locationX - touchStartRef.current.x;
          const dy = t.locationY - touchStartRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) return; // troppo corto, è un tap
          const dir = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          touchStartRef.current = null;
          void onButtonRef.current(node.onSwipeAction, { dir, dx: Math.round(dx), dy: Math.round(dy) });
        }}
      >
        {canvas}
      </Pressable>
    );
  }

  return <View key={nodeKey}>{canvas}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebGameNode — canvas 2D inside WebView at true 60fps, no sandbox overhead
// ─────────────────────────────────────────────────────────────────────────────

function buildWebGameHtml(code: string, width: number, height: number, allowNetwork: boolean): string {
  // Only escape </script> to prevent premature script tag closing
  const safeCode = code.replace(/<\/script>/gi, '<\\/script>');
  const gameKitRuntime = `
/* GameKit: small host-provided physics + levels helper for generated canvas games. */
(function(){
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function copy(src){var o={},k;if(!src)return o;for(k in src){if(Object.prototype.hasOwnProperty.call(src,k))o[k]=src[k];}return o;}
  function bounds(b){
    var w=b.w||((b.r||0)*2)||0,h=b.h||((b.r||0)*2)||0,x=b.x||0,y=b.y||0;
    var inset=Number(b.hitboxInset||0),scale=b.hitboxScale==null?1:Number(b.hitboxScale);
    if(scale>0&&scale<1){var nw=w*scale,nh=h*scale;x+=(w-nw)/2;y+=(h-nh)/2;w=nw;h=nh;}
    if(inset>0){x+=inset;y+=inset;w=Math.max(1,w-inset*2);h=Math.max(1,h-inset*2);}
    return{x:x,y:y,w:w,h:h};
  }
  function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function circleRectOverlap(c,r){
    var radius=(c.hitR||c.r||Math.min(c.w||20,c.h||20)/2)*(c.hitboxScale==null?1:Number(c.hitboxScale));
    var cx=(c.x||0)+(c.r||((c.w||20)/2)),cy=(c.y||0)+(c.r||((c.h||20)/2));
    var rb=bounds(r),nx=clamp(cx,rb.x,rb.x+rb.w),ny=clamp(cy,rb.y,rb.y+rb.h),dx=cx-nx,dy=cy-ny;
    return dx*dx+dy*dy<=radius*radius;
  }
  function bodiesOverlap(a,b){
    if(a.type==='circle'&&b.type!=='circle')return circleRectOverlap(a,b);
    if(b.type==='circle'&&a.type!=='circle')return circleRectOverlap(b,a);
    return rectsOverlap(bounds(a),bounds(b));
  }
  function centerX(b){var bb=bounds(b);return bb.x+bb.w/2;}
  function centerY(b){var bb=bounds(b);return bb.y+bb.h/2;}
  function drawBody(ctx,b){
    ctx.fillStyle=b.color||'#fff';
    if(b.type==='circle'){ctx.beginPath();ctx.arc((b.x||0)+(b.r||0),(b.y||0)+(b.r||0),b.r||8,0,Math.PI*2);ctx.fill();return;}
    ctx.fillRect(b.x||0,b.y||0,b.w||20,b.h||20);
  }
  function drawBackdrop(ctx,w,h,bg){
    var g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,bg||'#0f172a');g.addColorStop(1,'#020617');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=0.28;ctx.fillStyle='#38bdf8';
    for(var i=0;i<5;i++){ctx.beginPath();ctx.arc((i*91+40)%w,70+i*38,18+i*4,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }
  function roundRect(ctx,x,y,w,h,r){
    r=Math.min(r||8,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }
  function drawTextPill(ctx,text,x,y,w){
    ctx.fillStyle='rgba(15,23,42,0.72)';roundRect(ctx,x,y,w,32,10);ctx.fill();
    ctx.fillStyle='#e5e7eb';ctx.font='bold 14px sans-serif';ctx.textAlign='left';ctx.fillText(text,x+10,y+21);
  }
  function create(opts){
    opts=opts||{};
    var world={
      width:opts.width||window.WIDTH||360,
      height:opts.height||window.HEIGHT||600,
      gravityY:opts.gravityY==null?0.65:Number(opts.gravityY),
      bodies:[],
      levels:[],
      levelIndex:0,
      levelName:'',
      completed:false,
      status:'playing',
      message:'',
      transition:1,
      particles:[],
      shake:0,
      combo:0,
      background:opts.background||'#0f172a',
      score:0,
      input:{left:false,right:false,up:false,down:false,jump:false,fire:false},
      clear:function(){this.bodies=[];this.completed=false;this.status='playing';},
      add:function(body){
        var b=copy(body);
        b.id=b.id||('body'+this.bodies.length);
        b.type=b.type||'rect';
        b.x=Number(b.x||0);b.y=Number(b.y||0);
        b.w=Number(b.w||(b.r?b.r*2:24));b.h=Number(b.h||(b.r?b.r*2:24));
        b.vx=Number(b.vx||0);b.vy=Number(b.vy||0);
        b.bounce=Number(b.bounce||0);b.friction=b.friction==null?0.82:Number(b.friction);
        b.gravityScale=b.gravityScale==null?1:Number(b.gravityScale);
        b.static=!!b.static;b.solid=b.solid!==false;b.sensor=!!b.sensor;
        b.opacity=b.opacity==null?1:Number(b.opacity);
        this.bodies.push(b);return b;
      },
      get:function(id){for(var i=0;i<this.bodies.length;i++){if(this.bodies[i].id===id)return this.bodies[i];}return null;},
      setLevels:function(levels){this.levels=Array.isArray(levels)?levels:[];this.loadLevel(0);return this;},
      loadLevel:function(index){
        if(!this.levels.length)return false;
        this.clear();
        this.levelIndex=clamp(index,0,this.levels.length-1);
        var level=this.levels[this.levelIndex]||{};
        this.levelName=level.name||('Livello '+(this.levelIndex+1));
        this.message=this.levelName;
        this.transition=1;
        this.shake=0;
        this.background=level.background||this.background;
        this.score=level.keepScore?this.score:Number(level.score||this.score||0);
        this.gravityY=level.gravityY==null?this.gravityY:Number(level.gravityY);
        var bodies=Array.isArray(level.bodies)?level.bodies:[];
        for(var i=0;i<bodies.length;i++)this.add(bodies[i]);
        if(level.player)this.add(Object.assign({id:'player',tag:'player',color:'#60a5fa'},level.player));
        if(level.goal)this.add(Object.assign({id:'goal',tag:'goal',sensor:true,static:true,solid:false,color:'#22c55e'},level.goal));
        return true;
      },
      nextLevel:function(){
        if(this.levelIndex>=this.levels.length-1){this.completed=true;this.status='completed';this.message='Completato';this.emit(this.width/2,this.height/2,'#facc15',34);return false;}
        return this.loadLevel(this.levelIndex+1);
      },
      restartLevel:function(){return this.loadLevel(this.levelIndex);},
      fail:function(msg){if(this.status!=='playing')return;this.status='failed';this.message=msg||'Riprova';this.shakeScreen(10);},
      completeLevel:function(msg){var self=this;if(this.status!=='playing')return;this.status='levelComplete';this.message=msg||'Livello completato';this.emit(this.width/2,this.height/2,'#22c55e',26);this.shakeScreen(5);setTimeout(function(){if(self.status==='levelComplete')self.nextLevel();},650);},
      shakeScreen:function(power){this.shake=Math.max(this.shake,Number(power||6));},
      emit:function(x,y,color,count){
        count=count||16;color=color||'#fff';
        for(var i=0;i<count;i++){var a=Math.random()*Math.PI*2,s=1+Math.random()*4;this.particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:28+Math.random()*20,color:color,r:2+Math.random()*3});}
      },
      overlap:function(a,b){return bodiesOverlap(a,b);},
      touchesTag:function(body,tag){
        if(!body)return false;
        for(var i=0;i<this.bodies.length;i++){var b=this.bodies[i];if(b!==body&&b.tag===tag&&this.overlap(body,b))return true;}
        return false;
      },
      step:function(dt){
        this.transition=Math.max(0,this.transition-0.035);
        this.shake=Math.max(0,this.shake*0.88-0.15);
        var scale=clamp((dt||1/60)*60,0,3),i,j,a,b,ab,bb,px,py,ox,oy,fromTop;
        for(i=0;i<this.bodies.length;i++){
          a=this.bodies[i];a.onGround=false;
          if(a.static)continue;
          a.vy+=(this.gravityY*a.gravityScale)*scale;
          px=a.x;py=a.y;
          a.x+=a.vx*scale;a.y+=a.vy*scale;
          for(j=0;j<this.bodies.length;j++){
            b=this.bodies[j];if(a===b||!this.overlap(a,b))continue;
            if(a.onCollide)a.onCollide(b,this);
            if(b.onCollide)b.onCollide(a,this);
            if(b.sensor&&b.tag==='coin'&&a.tag==='player'){b.dead=true;this.score+=Number(b.value||1);this.combo++;this.emit(centerX(b),centerY(b),b.color||'#facc15',10);}
            if(b.tag==='hazard'&&a.tag==='player')this.fail('Game over');
            if(a.sensor||b.sensor||!b.solid)continue;
            ab=bounds(a);bb=bounds(b);
            ox=Math.min(ab.x+ab.w-bb.x,bb.x+bb.w-ab.x);
            oy=Math.min(ab.y+ab.h-bb.y,bb.y+bb.h-ab.y);
            if(ox<oy){
              a.x=centerX(a)<centerX(b)?b.x-ab.w:b.x+bb.w;
              a.vx=-(a.vx||0)*(a.bounce||0);
            }else{
              fromTop=py+ab.h<=b.y+2;
              a.y=fromTop?b.y-ab.h:b.y+bb.h;
              if(fromTop)a.onGround=true;
              a.vy=fromTop?-(a.vy||0)*(a.bounce||0):Math.max(0,a.vy||0);
              if(fromTop&&Math.abs(a.vy)<0.25)a.vy=0;
            }
          }
          if(a.y>this.height+180&&a.killBelow!==false){a.dead=true;}
        }
        for(i=0;i<this.particles.length;i++){var p=this.particles[i];p.x+=p.vx*scale;p.y+=p.vy*scale;p.vy+=0.12*scale;p.life-=scale;}
        this.particles=this.particles.filter(function(p){return p.life>0;});
        this.bodies=this.bodies.filter(function(b){return !b.dead;});
      },
      draw:function(ctx){
        var sx=this.shake?((Math.random()*2-1)*this.shake):0,sy=this.shake?((Math.random()*2-1)*this.shake):0;
        ctx.save();ctx.translate(sx,sy);drawBackdrop(ctx,this.width,this.height,this.background);
        for(var i=0;i<this.bodies.length;i++){ctx.save();ctx.globalAlpha=this.bodies[i].opacity==null?1:this.bodies[i].opacity;if(!this.bodies[i].static){ctx.shadowColor='rgba(0,0,0,0.35)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;}drawBody(ctx,this.bodies[i]);ctx.restore();}
        for(i=0;i<this.particles.length;i++){var p=this.particles[i];ctx.globalAlpha=clamp(p.life/34,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
        ctx.globalAlpha=1;ctx.restore();
        drawTextPill(ctx,this.levelName||('Livello '+(this.levelIndex+1)),8,8,142);
        drawTextPill(ctx,'Score '+this.score,this.width-112,8,104);
        if(this.transition>0){ctx.fillStyle='rgba(0,0,0,'+(this.transition*0.45)+')';ctx.fillRect(0,0,this.width,this.height);ctx.fillStyle='rgba(255,255,255,'+this.transition+')';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(this.message||this.levelName,this.width/2,this.height/2);}
        if(this.status==='failed'||this.status==='completed'){ctx.fillStyle='rgba(0,0,0,0.62)';ctx.fillRect(0,0,this.width,this.height);ctx.fillStyle='#fff';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(this.message,this.width/2,this.height/2-12);ctx.font='15px sans-serif';ctx.fillStyle='#cbd5e1';ctx.fillText(this.status==='failed'?'tocca per riprovare':'partita completata',this.width/2,this.height/2+24);}
      }
    };
    return world;
  }
  function bindPlatformControls(world,playerId,opts){
    opts=opts||{};var jumpPower=opts.jumpPower||12,speed=opts.speed||3.2;
    function setTouches(e){var i,x,y;world.input.left=false;world.input.right=false;world.input.jump=false;for(i=0;i<e.touches.length;i++){x=e.touches[i].clientX;y=e.touches[i].clientY;if(x<world.width*0.33)world.input.left=true;else if(x>world.width*0.67)world.input.right=true;if(y<world.height*0.75||x>world.width*0.58)world.input.jump=true;}}
    canvas.addEventListener('touchstart',function(e){e.preventDefault();setTouches(e);},{passive:false});
    canvas.addEventListener('touchmove',function(e){e.preventDefault();setTouches(e);},{passive:false});
    canvas.addEventListener('touchend',function(e){e.preventDefault();setTouches(e);},{passive:false});
    return function(){
      var p=world.get(playerId||'player');if(!p)return;
      p.vx=(world.input.right?speed:0)-(world.input.left?speed:0);
      if(world.input.jump&&p.onGround){p.vy=-jumpPower;p.onGround=false;}
    };
  }
  function startPlatformer(opts){
    opts=opts||{};var game=create(opts);game.setLevels(opts.levels||[]);var playerId=opts.playerId||'player';var controls=bindPlatformControls(game,playerId,opts.controls||{});
    canvas.addEventListener('touchstart',function(){if(game.status==='failed')game.restartLevel();},{passive:false});
    function frame(){var p=game.get(playerId);if(game.status==='playing'){controls();if(opts.update)opts.update(game,p);game.step(1/60);p=game.get(playerId);if(p&&p.dead)game.fail('Game over');if(p&&game.touchesTag(p,'goal'))game.completeLevel();}game.draw(ctx);if(opts.draw)opts.draw(game,ctx);requestAnimationFrame(frame);}
    requestAnimationFrame(frame);return game;
  }
  __def('GameKit',{create:create,bindPlatformControls:bindPlatformControls,startPlatformer:startPlatformer});
})();`;
  const networkGuard = allowNetwork
    ? ''
    : `
/* Network is denied unless the module declares "network", the user grants it,
   and the host build enables module network access. */
(function(){
  function denied(){throw new Error('Network APIs are disabled for this webGame module.');}
  try{Object.defineProperty(window,'fetch',{value:denied,writable:false,configurable:false});}catch(e){window.fetch=denied;}
  try{Object.defineProperty(window,'XMLHttpRequest',{value:function(){denied();},writable:false,configurable:false});}catch(e){window.XMLHttpRequest=function(){denied();};}
  try{Object.defineProperty(window,'WebSocket',{value:function(){denied();},writable:false,configurable:false});}catch(e){window.WebSocket=function(){denied();};}
  try{Object.defineProperty(window,'EventSource',{value:function(){denied();},writable:false,configurable:false});}catch(e){window.EventSource=function(){denied();};}
  if(window.navigator){try{Object.defineProperty(window.navigator,'sendBeacon',{value:function(){denied();},writable:false,configurable:false});}catch(e){window.navigator.sendBeacon=function(){denied();};}}
  try{Object.defineProperty(window,'importScripts',{value:denied,writable:false,configurable:false});}catch(e){window.importScripts=denied;}
})();`;
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{width:100%;height:100%;background:#000;overflow:hidden;touch-action:none;}
canvas{display:block;}
</style>
</head>
<body>
<canvas id="game" width="${width}" height="${height}" style="width:${width}px;height:${height}px;display:block;"></canvas>
<script>
/* Setup — prefixed names so game code cannot shadow them */
var __canvas=document.getElementById('game');
var __ctx=__canvas.getContext('2d');
var __W=${width},__H=${height};

/* Make canvas/ctx/WIDTH/HEIGHT/sendState non-writable globals.
   If AI code tries "var canvas=..." at top-level the assignment is silently
   ignored in sloppy mode and the original value is preserved. */
function __def(k,v){try{Object.defineProperty(window,k,{value:v,writable:false,configurable:false,enumerable:true});}catch(e){try{window[k]=v;}catch(e2){}}}
__def('canvas',__canvas);
__def('ctx',__ctx);
__def('WIDTH',__W);
__def('HEIGHT',__H);
__def('sendState',function(p){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'state',patch:p}));}catch(e){}});
${networkGuard}
${gameKitRuntime}

/* Gamepad bridge: receive button events from React Native */
function __onMsg(e){try{var d=JSON.parse(e.data);if(d&&d.type==='btn'&&typeof window.__onBtn==='function')window.__onBtn(d.id,d.on);}catch(ex){}}
document.addEventListener('message',__onMsg);window.addEventListener('message',__onMsg);

/* --- GAME CODE (runs in global scope so RAF/setTimeout work as expected) --- */
try{
${safeCode}
}catch(__err){
  /* Use __ctx (never overridable) so error display always works */
  __ctx.fillStyle='#1a0808';__ctx.fillRect(0,0,__W,__H);
  __ctx.fillStyle='#f87171';__ctx.font='bold 14px sans-serif';__ctx.textAlign='center';
  __ctx.fillText('Game Error:',__W/2,__H/2-20);
  __ctx.font='12px monospace';__ctx.fillStyle='#fca5a5';
  var __m=String(__err&&__err.message||__err),__ww=__m.split(' '),__ll='',__yy=__H/2+2;
  __ww.forEach(function(w){if((__ll+w).length>38){__ctx.fillText(__ll.trim(),__W/2,__yy);__yy+=17;__ll='';}__ll+=w+' ';});
  if(__ll.trim())__ctx.fillText(__ll.trim(),__W/2,__yy);
}
</script>
</body>
</html>`;
}

function WebGameNode({
  node,
  ctx,
  nodeKey,
}: {
  node: Extract<UiNode, { type: 'webGame' }>;
  ctx: RenderCtx;
  nodeKey: string;
}) {
  const webViewRef = useRef<WebView>(null);
  // Expose webViewRef to ctx so GamepadNode can send button events
  ctx.webViewRef = webViewRef;

  const gw = node.width ?? 360;
  const gh = node.height ?? 600;
  const code = ctx.webgameCode ?? '// no game code';
  const allowNetwork = ctx.webGameAllowNetwork === true;
  const html = useMemo(() => buildWebGameHtml(code, gw, gh, allowNetwork), [code, gw, gh, allowNetwork]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; patch?: Record<string, unknown> };
      if (data.type === 'state' && data.patch) {
        ctx.setState(data.patch);
      }
    } catch { /* ignore parse errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      key={nodeKey}
      style={[{
        width: gw,
        height: gh,
        overflow: 'hidden',
        alignSelf: 'center',
      }, layoutToViewStyle(node.layout)]}
    >
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#000' }}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={allowNetwork ? ['*'] : ['about:blank']}
        onShouldStartLoadWithRequest={(request) => allowNetwork || request.url === 'about:blank'}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={onMessage}
        androidLayerType="hardware"
      />
    </View>
  );
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
        if (node.navigate) {
          ctx.onNavigate(node.navigate);
        } else if (actionName) {
          void ctx.onButton(actionName, node.actionInput ?? {});
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
          renderItem={({ item }) => {
            let mainLabel = '';
            let subLabel = '';
            if (typeof item === 'string') {
              mainLabel = item;
            } else if (item && typeof item === 'object' && !Array.isArray(item)) {
              const obj = item as Record<string, unknown>;
              // Cerca un campo "principale" da mostrare in grassetto
              const primary = obj.name ?? obj.title ?? obj.label ?? obj.text ?? obj.description;
              if (primary != null) {
                mainLabel = String(primary);
                // Tutti gli altri campi (esclusi id e il campo principale) come sottotitolo
                subLabel = Object.entries(obj)
                  .filter(([k, v]) =>
                    !['id', 'name', 'title', 'label', 'text', 'description'].includes(k) &&
                    v !== null && v !== undefined && v !== ''
                  )
                  .map(([k, v]) => {
                    if (typeof v === 'boolean') return `${k}: ${v ? '✓' : '✗'}`;
                    return `${k}: ${String(v)}`;
                  })
                  .join('   ·   ');
              } else {
                // Nessun campo noto → mostra tutto come coppie chiave: valore
                mainLabel = Object.entries(obj)
                  .filter(([k, v]) => k !== 'id' && v !== null && v !== undefined && v !== '')
                  .map(([k, v]) => {
                    if (typeof v === 'boolean') return `${k}: ${v ? '✓' : '✗'}`;
                    return `${k}: ${String(v)}`;
                  })
                  .join('   ·   ');
              }
            } else {
              mainLabel = String(item ?? '');
            }
            return (
              <View style={{ paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border, gap: 3 }}>
                <Text style={{ color: t.text, fontWeight: mainLabel && subLabel ? '600' : '400' }}>{mainLabel}</Text>
                {subLabel ? <Text style={{ color: t.muted, fontSize: 13 }}>{subLabel}</Text> : null}
              </View>
            );
          }}
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
      const raw = ctx.state[node.bind];
      // Support both string URI and object with { uri } (e.g. full camera result stored in state)
      const uri =
        typeof raw === 'string'
          ? raw
          : raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).uri === 'string'
          ? ((raw as Record<string, unknown>).uri as string)
          : '';
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
          onError={(e) => console.warn('[Image] load error for', uri, e.nativeEvent.error)}
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

    case 'timer':
      return null;

    case 'webGame':
      return <WebGameNode key={key} node={node} ctx={ctx} nodeKey={key} />;

    case 'gameView':
      return <GameViewNode key={key} node={node} ctx={ctx} nodeKey={key} />;

    case 'gamepad':
      return <GamepadNode key={key} node={node} ctx={ctx} nodeKey={key} />;

    default:
      return null;
  }
}
