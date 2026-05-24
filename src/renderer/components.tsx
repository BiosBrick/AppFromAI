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
// Ticker — nodo invisibile che chiama un'action a intervalli regolari.
// Usare per timer, countdown, polling. Nessun rendering.
// ─────────────────────────────────────────────────────────────────────────────

function TickerNode({
  node,
  ctx,
}: {
  node: Extract<UiNode, { type: 'ticker' }>;
  ctx: RenderCtx;
}) {
  const onButtonRef = useRef(ctx.onButton);
  onButtonRef.current = ctx.onButton;
  // stateRef aggiornato ad ogni render — evita stale closure dentro setInterval
  const stateRef = useRef(ctx.state);
  stateRef.current = ctx.state;
  const busyRef = useRef(false);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    if (ctx.hasError) return;
    const ms = Math.max(100, node.tickMs);

    const runTick = () => {
      if (node.running != null && !stateRef.current[node.running]) return;
      if (busyRef.current) return;
      busyRef.current = true;
      const now = Date.now();
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      onButtonRef.current(node.tickAction, { dt, dtMs: Math.round(dt * 1000) }).finally(() => {
        busyRef.current = false;
      });
    };

    const id = setInterval(runTick, ms);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.hasError, node.tickAction, node.tickMs, node.running]);

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

function buildWebGameHtml(code: string, width: number, height: number): string {
  // Only escape </script> to prevent premature script tag closing
  const safeCode = code.replace(/<\/script>/gi, '<\\/script>');
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
  const html = useMemo(() => buildWebGameHtml(code, gw, gh), [code, gw, gh]);

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
        originWhitelist={['*']}
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

    case 'ticker':
      return <TickerNode key={key} node={node} ctx={ctx} />;

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
