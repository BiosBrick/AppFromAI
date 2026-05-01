import type { MotherPermission } from '../types/generatedModule';
import type { MotherApi } from './types';
import { CapabilityRegistry } from './capabilityRegistry';
import { createCameraCapability } from './camera';
import { createAudioRecorderCapability } from './audioRecorder';
import { createAudioPlayerCapability } from './audioPlayer';
import { createQrScannerCapability } from './qrScanner';
import { createModuleStorage } from './storage';
import { createNetworkCapability } from './network';
import { createNotificationsCapability } from './notifications';
import { createLinkingCapability } from './linking';
import { createTorchCapability } from './torch';
import { createLocationCapability } from './location';
import { createSensorsCapability } from './sensors';
import { createFileStorageCapability } from './fileStorage';
import { createClipboardCapability } from './clipboard';
import { createHapticsCapability } from './haptics';
import { createShareCapability } from './share';
import { createTtsCapability } from './tts';
import { createModulesCapability } from './modulesCapability';

type GrantSet = Set<MotherPermission>;

function deny(name: string): never {
  throw new Error(`Capability non disponibile: ${name}`);
}

export type MotherApiOptions = {
  moduleId: string;
  manifestPermissions: MotherPermission[];
  granted: GrantSet;
  allowNetworkFetch: boolean;
  registry: CapabilityRegistry;
  callDepth?: number;
};

export function createMotherApi(opts: MotherApiOptions): MotherApi {
  const { moduleId, manifestPermissions, granted, allowNetworkFetch, registry, callDepth = 0 } = opts;
  const manifest = new Set(manifestPermissions);

  const can = (p: MotherPermission) => manifest.has(p) && granted.has(p);

  const cameraImpl = createCameraCapability(registry);
  const audioImpl = createAudioRecorderCapability(registry);
  const playerImpl = createAudioPlayerCapability(registry);
  const qrImpl = createQrScannerCapability();
  const storageImpl = createModuleStorage(moduleId);
  const networkImpl = createNetworkCapability(allowNetworkFetch);
  const notificationsImpl = createNotificationsCapability();
  const linkingImpl = createLinkingCapability();
  const torchImpl = createTorchCapability(registry);
  const locationImpl = createLocationCapability();
  const sensorsImpl = createSensorsCapability();
  const filesImpl = createFileStorageCapability(moduleId);
  const clipboardImpl = createClipboardCapability();
  const hapticsImpl = createHapticsCapability();
  const shareImpl = createShareCapability();
  const ttsImpl = createTtsCapability(registry);
  const modulesImpl = createModulesCapability(
    granted,
    allowNetworkFetch,
    CapabilityRegistry,
    (childOpts) => createMotherApi(childOpts),
    callDepth
  );

  const setTorchEnabled = async (on: boolean) => {
    if (!can('torch')) deny('torch');
    return torchImpl.setEnabled(on);
  };
  const torch = Object.assign(setTorchEnabled, {
    setEnabled: setTorchEnabled,
  });

  return {
    camera: {
      takePhoto: async () => {
        if (!can('camera')) deny('camera');
        return cameraImpl.takePhoto();
      },
    },
    audioRecorder: {
      start: async () => {
        if (!can('audioRecorder')) deny('audioRecorder');
        return audioImpl.start();
      },
      stop: async () => {
        if (!can('audioRecorder')) deny('audioRecorder');
        return audioImpl.stop();
      },
    },
    audioPlayer: {
      play: async (uri) => {
        if (!can('audioRecorder')) deny('audioRecorder');
        return playerImpl.play(uri);
      },
      stop: async () => {
        return playerImpl.stop();
      },
      pause: async () => {
        return playerImpl.pause();
      },
      resume: async () => {
        return playerImpl.resume();
      },
      getStatus: async () => {
        return playerImpl.getStatus();
      },
    },
    qrScanner: {
      scan: async () => {
        if (!can('qrScanner')) deny('qrScanner');
        return qrImpl.scan();
      },
    },
    storage: {
      save: async (key, value) => {
        if (!can('storage')) deny('storage');
        return storageImpl.save(key, value);
      },
      load: async (key) => {
        if (!can('storage')) deny('storage');
        return storageImpl.load(key);
      },
      list: async () => {
        if (!can('storage')) deny('storage');
        return storageImpl.list();
      },
      delete: async (key) => {
        if (!can('storage')) deny('storage');
        return storageImpl.delete(key);
      },
    },
    network: {
      fetch: async (input, init) => {
        if (!can('network')) deny('network');
        return networkImpl.fetch(input, init);
      },
    },
    notifications: {
      schedule: async (title, body, secondsFromNow) => {
        if (!can('notifications')) deny('notifications');
        return notificationsImpl.schedule(title, body, secondsFromNow);
      },
    },
    location: {
      getCurrentPosition: async () => {
        if (!can('location')) deny('location');
        return locationImpl.getCurrentPosition();
      },
    },
    sensors: {
      getAccelerometer: async () => {
        if (!can('sensors')) deny('sensors');
        return sensorsImpl.getAccelerometer();
      },
      getGyroscope: async () => {
        if (!can('sensors')) deny('sensors');
        return sensorsImpl.getGyroscope();
      },
      getMagnetometer: async () => {
        if (!can('sensors')) deny('sensors');
        return sensorsImpl.getMagnetometer();
      },
      getBarometer: async () => {
        if (!can('sensors')) deny('sensors');
        return sensorsImpl.getBarometer();
      },
      getLight: async () => {
        if (!can('sensors')) deny('sensors');
        return sensorsImpl.getLight();
      },
    },
    linking: {
      openUrl: async (url) => {
        if (!can('linking')) deny('linking');
        return linkingImpl.openUrl(url);
      },
      composeEmail: async (opts) => {
        if (!can('linking')) deny('linking');
        return linkingImpl.composeEmail(opts);
      },
      dialPhone: async (phone) => {
        if (!can('linking')) deny('linking');
        return linkingImpl.dialPhone(phone);
      },
      sendSms: async (phone, body) => {
        if (!can('linking')) deny('linking');
        return linkingImpl.sendSms(phone, body);
      },
    },
    torch,
    files: {
      save: async (key, sourceUri) => {
        if (!can('storage')) deny('storage');
        return filesImpl.save(key, sourceUri);
      },
      load: async (key) => {
        if (!can('storage')) deny('storage');
        return filesImpl.load(key);
      },
      delete: async (key) => {
        if (!can('storage')) deny('storage');
        return filesImpl.delete(key);
      },
      list: async () => {
        if (!can('storage')) deny('storage');
        return filesImpl.list();
      },
    },
    clipboard: {
      set: async (text) => clipboardImpl.set(text),
      get: async () => clipboardImpl.get(),
    },
    haptics: {
      impact: async (style) => hapticsImpl.impact(style),
      notification: async (type) => hapticsImpl.notification(type),
      selection: async () => hapticsImpl.selection(),
    },
    share: {
      text: async (message, title) => shareImpl.text(message, title),
      file: async (uri, message) => shareImpl.file(uri, message),
    },
    tts: {
      speak: async (text, opts) => ttsImpl.speak(text, opts),
      stop: async () => ttsImpl.stop(),
      isSpeaking: async () => ttsImpl.isSpeaking(),
    },
    modules: {
      list: () => modulesImpl.list(),
      run: (id, action, input, initialState) =>
        modulesImpl.run(id, action, input, initialState),
    },
  };
}
