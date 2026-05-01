import { Camera } from 'expo-camera';
import { applyTorchFromModule } from './torchBridge';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createTorchCapability(registry: CapabilityRegistry) {
  let isOn = false;

  const forceOff = async () => {
    if (isOn) {
      isOn = false;
      applyTorchFromModule(false);
    }
    registry.unregister('torch');
  };

  return {
    async setEnabled(on: unknown) {
      const perm = await Camera.requestCameraPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Permesso fotocamera negato (serve per la torcia).');
      }
      applyTorchFromModule(on);
      const enabling = toBoolean(on);
      isOn = enabling;
      if (enabling) {
        registry.register('torch', forceOff);
      } else {
        registry.unregister('torch');
      }
    },
  };
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'off' || v === 'no' || v === '') return false;
  }
  return Boolean(value);
}
