type CleanupFn = () => Promise<void> | void;

/**
 * Registro dei sensori/risorse attive per un singolo modulo.
 * Ogni capability vi registra la propria funzione di cleanup.
 * Il module screen chiama cleanupAll() quando il componente si smonta.
 */
export class CapabilityRegistry {
  private cleanups = new Map<string, CleanupFn>();

  register(id: string, fn: CleanupFn) {
    this.cleanups.set(id, fn);
  }

  unregister(id: string) {
    this.cleanups.delete(id);
  }

  async cleanupAll(): Promise<void> {
    const fns = [...this.cleanups.values()];
    this.cleanups.clear();
    await Promise.allSettled(fns.map((fn) => Promise.resolve().then(() => fn())));
  }
}
