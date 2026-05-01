import * as Linking from 'expo-linking';

const ALLOWED = ['mailto:', 'tel:', 'sms:'];

function assertAllowedUrl(url: string): string {
  const t = url.trim();
  const low = t.toLowerCase();
  if (low.startsWith('javascript:') || low.startsWith('file:') || low.startsWith('blob:')) {
    throw new Error('Schema URL non consentito');
  }
  if (!ALLOWED.some((p) => low.startsWith(p))) {
    throw new Error('Solo mailto:, tel: e sms: sono consentiti (usa api.linking).');
  }
  return t;
}

export function buildMailtoUrl(opts: { to?: string; subject?: string; body?: string }): string {
  const to = (opts.to ?? '').trim();
  const params = new URLSearchParams();
  if (opts.subject != null && opts.subject !== '') params.append('subject', opts.subject);
  if (opts.body != null && opts.body !== '') params.append('body', opts.body);
  const qs = params.toString();
  return qs ? `mailto:${to}?${qs}` : `mailto:${to}`;
}

export function buildTelUrl(phone: unknown): string {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!digits) throw new Error('Numero di telefono vuoto');
  return `tel:${digits}`;
}

export function buildSmsUrl(phone: unknown, body?: unknown): string {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!digits) throw new Error('Numero SMS vuoto');
  if (body != null && body !== '') {
    return `sms:${digits}?body=${encodeURIComponent(String(body))}`;
  }
  return `sms:${digits}`;
}

export function createLinkingCapability() {
  const openUrl = async (url: unknown): Promise<{ opened: boolean }> => {
    const u = assertAllowedUrl(String(url ?? ''));
    try {
      await Linking.openURL(u);
      return { opened: true };
    } catch {
      return { opened: false };
    }
  };

  return {
    openUrl,
    composeEmail: async (opts: { to?: string; subject?: string; body?: string }) => {
      return openUrl(buildMailtoUrl(opts));
    },
    dialPhone: async (phone: string) => {
      return openUrl(buildTelUrl(phone));
    },
    sendSms: async (phone: string, body?: string) => {
      return openUrl(buildSmsUrl(phone, body));
    },
  };
}
