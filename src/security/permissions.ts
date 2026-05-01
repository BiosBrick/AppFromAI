import type { MotherPermission } from '../types/generatedModule';

export const PERMISSION_LABELS: Record<
  MotherPermission,
  { title: string; android: string }
> = {
  camera: { title: 'Fotocamera', android: 'Fotocamera (foto)' },
  audioRecorder: { title: 'Registrazione audio', android: 'Microfono' },
  qrScanner: { title: 'Scanner QR', android: 'Fotocamera' },
  torch: { title: 'Torcia LED', android: 'Fotocamera (torcia)' },
  location: { title: 'Posizione', android: 'GPS / posizione' },
  sensors: { title: 'Sensori dispositivo', android: 'Sensori movimento / ambiente' },
  linking: { title: 'Collegamenti sistema', android: 'Telefono, email e SMS (app esterne)' },
  storage: { title: 'Archiviazione modulo', android: 'Storage (dati modulo)' },
  network: { title: 'Rete', android: 'Internet' },
  notifications: { title: 'Notifiche', android: 'Notifiche' },
};

export function describePermissionsForUi(perms: MotherPermission[]): string {
  if (perms.length === 0) return 'Nessun permesso aggiuntivo.';
  return perms.map((p) => PERMISSION_LABELS[p].android).join(', ');
}
