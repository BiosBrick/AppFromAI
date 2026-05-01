type ScanHandler = (result: string | null) => void;

let pending: ScanHandler | null = null;
let openUi: (() => void) | null = null;

/** Registra l’apertura del modale fotocamera (es. da root layout). */
export function registerQrScanUiOpener(fn: (() => void) | null) {
  openUi = fn;
}

export function requestQrScan(): Promise<string | null> {
  return new Promise((resolve) => {
    pending = resolve;
    openUi?.();
  });
}

export function resolveQrScan(result: string | null) {
  const fn = pending;
  pending = null;
  fn?.(result);
}


export function isQrScanPending(): boolean {
  return pending != null;
}
