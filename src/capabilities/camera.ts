import { Camera } from 'expo-camera';
import { requestCameraPhoto, cancelPendingCameraPhoto } from './cameraBridge';
import type { CapabilityRegistry } from './capabilityRegistry';

export function createCameraCapability(registry: CapabilityRegistry) {
  return {
    async takePhoto() {
      const perm = await Camera.requestCameraPermissionsAsync();
      if (!perm.granted) {
        throw new Error('Permesso fotocamera negato');
      }
      // Registra il cleanup: se il modulo viene smontato mentre la modal è aperta,
      // la Promise viene risolta con null invece di restare appesa.
      registry.register('camera-pending', () => cancelPendingCameraPhoto());
      try {
        return await requestCameraPhoto();
      } finally {
        registry.unregister('camera-pending');
      }
    },
  };
}
