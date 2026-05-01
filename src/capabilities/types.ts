export type TorchCapability = {
  (on: boolean): Promise<void>;
  setEnabled: (on: boolean) => Promise<void>;
};

export type MotherApi = {
  camera: {
    takePhoto: () => Promise<{ uri: string; width?: number; height?: number } | null>;
  };
  audioRecorder: {
    start: () => Promise<void>;
    stop: () => Promise<{ uri: string; durationMs?: number } | null>;
  };
  audioPlayer: {
    play: (uri: string) => Promise<{ durationMs?: number }>;
    stop: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    getStatus: () => Promise<{ isPlaying: boolean; positionMs?: number; durationMs?: number }>;
  };
  qrScanner: {
    scan: () => Promise<string | null>;
  };
  storage: {
    save: (key: string, value: unknown) => Promise<void>;
    load: (key: string) => Promise<unknown | null>;
    list: () => Promise<string[]>;
    delete: (key: string) => Promise<void>;
  };
  network: {
    fetch: (
      input: string,
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }
    ) => Promise<{ ok: boolean; status: number; text: string }>;
  };
  notifications: {
    schedule: (title: string, body: string, secondsFromNow: number) => Promise<string>;
  };
  location: {
    getCurrentPosition: () => Promise<{
      latitude: number;
      longitude: number;
      accuracy: number | null;
      altitude: number | null;
      heading: number | null;
      speed: number | null;
      timestamp: number;
    }>;
  };
  sensors: {
    getAccelerometer: () => Promise<Record<string, number>>;
    getGyroscope: () => Promise<Record<string, number>>;
    getMagnetometer: () => Promise<Record<string, number>>;
    getBarometer: () => Promise<Record<string, number>>;
    getLight: () => Promise<Record<string, number>>;
  };
  /** mailto / tel / sms tramite sistema (nessun http generico). */
  linking: {
    openUrl: (url: string) => Promise<{ opened: boolean }>;
    composeEmail: (opts: {
      to?: string;
      subject?: string;
      body?: string;
    }) => Promise<{ opened: boolean }>;
    dialPhone: (phone: string) => Promise<{ opened: boolean }>;
    sendSms: (phone: string, body?: string) => Promise<{ opened: boolean }>;
  };
  /** Torcia LED (fotocamera posteriore, sessione controllata dalla app madre). */
  torch: TorchCapability;
  /** File persistenti sul dispositivo (gated da 'storage'). */
  files: {
    save: (key: string, sourceUri: string) => Promise<{ uri: string }>;
    load: (key: string) => Promise<string | null>;
    delete: (key: string) => Promise<void>;
    list: () => Promise<string[]>;
  };
  /** Appunti di sistema (clipboard). */
  clipboard: {
    set: (text: string) => Promise<void>;
    get: () => Promise<string>;
  };
  /** Feedback aptico (vibrazione). */
  haptics: {
    impact: (style?: 'light' | 'medium' | 'heavy') => Promise<void>;
    notification: (type?: 'success' | 'warning' | 'error') => Promise<void>;
    selection: () => Promise<void>;
  };
  /** Condivisione testo o file tramite il sistema operativo. */
  share: {
    text: (message: string, title?: string) => Promise<{ shared: boolean }>;
    file: (uri: string, message?: string) => Promise<{ shared: boolean }>;
  };
  /** Text-to-speech (sintesi vocale). */
  tts: {
    speak: (text: string, opts?: { language?: string; pitch?: number; rate?: number }) => Promise<void>;
    stop: () => Promise<void>;
    isSpeaking: () => Promise<boolean>;
  };
  /** Comunicazione tra moduli. */
  modules: {
    list: () => Promise<Array<{ id: string; name: string }>>;
    run: (
      id: string,
      action: string,
      input?: Record<string, unknown>,
      initialState?: Record<string, unknown>
    ) => Promise<unknown>;
  };
};

export type ModuleAction = (
  api: MotherApi,
  input: Record<string, unknown>,
  state: Record<string, unknown>
) => Promise<unknown>;
