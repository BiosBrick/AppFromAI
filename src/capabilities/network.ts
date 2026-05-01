export function createNetworkCapability(enabled: boolean) {
  return {
    async fetch(
      input: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string }
    ) {
      if (!enabled) {
        throw new Error('api.network.fetch disattivata dalla app madre');
      }
      const res = await globalThis.fetch(input, {
        method: init?.method ?? 'GET',
        headers: init?.headers,
        body: init?.body,
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    },
  };
}
