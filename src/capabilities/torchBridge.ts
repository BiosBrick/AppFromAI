let torchHandler: ((on: boolean) => void) | null = null;

export function toTorchBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'off' || v === 'no' || v === '') return false;
  }
  return Boolean(value);
}

export function registerTorchHost(handler: ((on: boolean) => void) | null) {
  torchHandler = handler;
}

export function applyTorchFromModule(on: unknown) {
  torchHandler?.(toTorchBoolean(on));
}
