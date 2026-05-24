/**
 * Schema UI per moduli (albero ricorsivo). Definito manualmente per evitare inferenza circolare TS↔Zod.
 */

/** Flex/margin controllati (no position assoluto: meglio per schermi diversi). */
export type UiLayoutProps = {
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number | string;
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  /** Solo testo / campi: allineamento orizzontale del contenuto. */
  textAlign?: 'left' | 'center' | 'right';
};

/** Palette colori del modulo — tutti i token sono opzionali (il default è il tema AppFromAI). */
export type UiTheme = {
  bg?: string;
  surface?: string;
  border?: string;
  primary?: string;
  text?: string;
  muted?: string;
};

/** Stile visivo diretto su un singolo componente (sovrascrive il tema). */
export type UiStyleProps = {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700' | '800' | '900' | 'bold' | 'normal';
  borderRadius?: number;
  padding?: number;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
};

/** Schermata interna a un navigator. */
export type NavigatorScreen = {
  type: 'screen';
  title: string;
  components: UiNode[];
  gap?: number;
  padding?: number;
  theme?: UiTheme;
  /** Nome dell'action da chiamare automaticamente ogni volta che questa schermata diventa attiva. */
  onFocus?: string;
};

export type UiNode =
  | {
      type: 'navigator';
      initialScreen: string;
      theme?: UiTheme;
      screens: Record<string, NavigatorScreen>;
    }
  | {
      type: 'screen';
      title: string;
      components: UiNode[];
      gap?: number;
      padding?: number;
      theme?: UiTheme;
    }
  | { type: 'text'; id?: string; text?: string; bind?: string; layout?: UiLayoutProps; style?: UiStyleProps }
  | {
      type: 'input';
      id: string;
      placeholder?: string;
      bind: string;
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      layout?: UiLayoutProps;
      style?: UiStyleProps;
    }
  | { type: 'textarea'; id: string; placeholder?: string; bind: string; layout?: UiLayoutProps; style?: UiStyleProps }
  | {
      type: 'button';
      id: string;
      text: string;
      /** Action da chiamare nel codice. Opzionale se "navigate" è presente. */
      action?: string;
      /** Naviga direttamente a questa schermata (solo dentro navigator). "__back" per tornare indietro. */
      navigate?: string;
      actionInput?: Record<string, unknown>;
      variant?: 'primary' | 'secondary' | 'danger';
      layout?: UiLayoutProps;
      style?: UiStyleProps;
    }
  | { type: 'list'; id?: string; bind: string; emptyText?: string; layout?: UiLayoutProps }
  | {
      type: 'box';
      id?: string;
      direction?: 'row' | 'column';
      gap?: number;
      padding?: number;
      wrap?: boolean;
      alignItems?: 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline';
      justifyContent?:
        | 'flex-start'
        | 'flex-end'
        | 'center'
        | 'space-between'
        | 'space-around'
        | 'space-evenly';
      components: UiNode[];
      layout?: UiLayoutProps;
    }
  | { type: 'card'; id?: string; components: UiNode[]; layout?: UiLayoutProps; style?: UiStyleProps }
  | { type: 'image'; id?: string; bind: string; height?: number; layout?: UiLayoutProps }
  | { type: 'audioRecorder'; id?: string; statusBind?: string; layout?: UiLayoutProps }
  | { type: 'qrScanner'; id?: string; hint?: string; layout?: UiLayoutProps }
  | {
      /** Ticker gestito dall'host: chiama tickAction a intervalli regolari. Non renderizza UI visibile. */
      type: 'timer';
      id?: string;
      tickAction: string;
      /** Millisecondi tra un tick e l'altro. Default 1000, minimo 100. */
      intervalMs?: number;
      /** Se true, esegue un tick appena il timer diventa attivo. */
      runImmediately?: boolean;
      /** Se presente, il timer gira solo quando state[activeBind] è truthy. */
      activeBind?: string;
      /** Senza activeBind default true; con activeBind inizializza quel bind a true solo se autoStart è true. */
      autoStart?: boolean;
      layout?: UiLayoutProps;
    }
  | {
      /** Motore gioco WebView — canvas 2D + requestAnimationFrame 60fps nativi */
      type: 'webGame';
      id?: string;
      width?: number;
      height?: number;
      layout?: UiLayoutProps;
    }
  | {
      type: 'gamepad';
      id?: string;
      /**
       * Layout dei tasti:
       * - 'row'   → riga orizzontale (default, 2-4 tasti: sinistra/destra/azione)
       * - 'dpad'  → croce direzionale (4 tasti: su/giù/sinistra/destra) + tasti extra a destra
       * - 'split' → metà sinistra e metà destra dello schermo (ideal per controllare con i pollici)
       */
      direction?: 'row' | 'dpad' | 'split';
      buttons: {
        id: string;
        label: string;
        /** Action da chiamare. Stringa vuota = tasto decorativo senza azione. */
        action: string;
        /** Se true, l'action si ripete ogni holdMs ms finché il tasto è tenuto premuto. */
        hold?: boolean;
        /** Millisecondi tra ripetizioni in modalità hold (default: 80). */
        holdMs?: number;
        style?: UiStyleProps;
      }[];
      /** Dimensione dei tasti in px (default 64). */
      buttonSize?: number;
      layout?: UiLayoutProps;
    }
  | {
      type: 'gameView';
      id?: string;
      /** Chiave di stato che contiene l'array di SceneObject da disegnare. */
      bind: string;
      width?: number;
      height?: number;
      /** Millisecondi tra un tick e l'altro (default 50 = 20fps). Min 16ms. Precede fps. */
      tickMs?: number;
      /** Frame rate target (10-60, default 20). Ignorato se tickMs è definito. */
      fps?: number;
      /** Nome dell'action chiamata ad ogni tick del loop di gioco. */
      tickAction?: string;
      /** Nome dell'action chiamata al tap sul canvas; riceve { x, y, jump:-8 } nell'input. */
      onTapAction?: string;
      /** Nome dell'action chiamata allo swipe sul canvas; riceve { dir:'left'|'right'|'up'|'down', dx, dy }. */
      onSwipeAction?: string;
      layout?: UiLayoutProps;
      onCollideAction?: string;
      onOutOfBoundsAction?: string;
    };

/** Oggetto della scena di gioco. I campi vx/vy/gravity abilitano fisica automatica nel renderer. */
export type SceneObject = {
  type: 'rect' | 'circle' | 'text';
  id?: string;
  x: number;
  y: number;
  /** Velocità orizzontale (px/tick). */
  vx?: number;
  /** Velocità verticale (px/tick). */
  vy?: number;
  /** Override locale della gravità per questo oggetto. */
  gravity?: number;
  w?: number;
  h?: number;
  r?: number;
  color?: string;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
};
