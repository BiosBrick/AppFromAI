type PhotoResult = { uri: string; width?: number; height?: number } | null;
type PhotoResolve = (result: PhotoResult) => void;

let pending: PhotoResolve | null = null;
let openUi: (() => void) | null = null;

export function registerCameraCaptureUiOpener(fn: (() => void) | null) {
  openUi = fn;
}

export function requestCameraPhoto(): Promise<PhotoResult> {
  // Se esiste già una richiesta pendente, la cancella prima di aprire una nuova.
  // Evita che due action chiamino takePhoto contemporaneamente lasciando Promise in sospeso.
  if (pending) {
    const prev = pending;
    pending = null;
    prev(null);
  }

  return new Promise((resolve) => {
    if (!openUi) {
      // Modal non registrata (mai dovrebbe accadere, ma gestisci gracefully).
      resolve(null);
      return;
    }
    pending = resolve;
    openUi();
  });
}

export function resolveCameraPhoto(result: PhotoResult) {
  const fn = pending;
  pending = null;
  fn?.(result);
}

/**
 * Cancella la richiesta foto pendente risolvendo la Promise con null.
 * Chiamato dal cleanup del modulo (CapabilityRegistry) quando il modulo
 * viene chiuso con la modal ancora aperta.
 */
export function cancelPendingCameraPhoto() {
  resolveCameraPhoto(null);
}
