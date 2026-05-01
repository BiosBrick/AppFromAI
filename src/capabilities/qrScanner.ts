import { requestQrScan } from './qrBridge';

export function createQrScannerCapability() {
  return {
    scan: () => requestQrScan(),
  };
}
