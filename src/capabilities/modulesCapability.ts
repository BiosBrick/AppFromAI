import type { MotherPermission } from '../types/generatedModule';
import type { MotherApi } from './types';
import type { CapabilityRegistry } from './capabilityRegistry';
import { getModule, listModules } from '../modules/moduleStore';
import { tryCompileModuleActions, runAction } from '../modules/moduleRunner';

const MAX_DEPTH = 3;

export type CreateChildApi = (opts: {
  moduleId: string;
  manifestPermissions: MotherPermission[];
  granted: Set<MotherPermission>;
  allowNetworkFetch: boolean;
  registry: CapabilityRegistry;
  callDepth: number;
}) => MotherApi;

export function createModulesCapability(
  callerGranted: Set<MotherPermission>,
  allowNetworkFetch: boolean,
  RegistryClass: new () => CapabilityRegistry,
  createChildApi: CreateChildApi,
  callDepth = 0
) {
  return {
    async list(): Promise<Array<{ id: string; name: string }>> {
      const mods = await listModules();
      return mods.map((m) => ({ id: m.id, name: m.name }));
    },

    async run(
      id: string,
      action: string,
      input: Record<string, unknown> = {},
      initialState: Record<string, unknown> = {}
    ): Promise<unknown> {
      if (callDepth >= MAX_DEPTH) {
        throw new Error(
          `Profondità massima chiamate tra moduli (${MAX_DEPTH}) superata.`
        );
      }

      const mod = await getModule(id);
      if (!mod) throw new Error(`Modulo "${id}" non trovato.`);

      const compiled = tryCompileModuleActions(mod.code);
      if (!compiled.ok) {
        throw new Error(`Modulo "${id}" non compilabile: ${compiled.error}`);
      }

      // Il figlio ottiene solo i permessi che ha nel manifest E che il chiamante ha già concessi.
      const childGranted = new Set(
        mod.manifest.permissions.filter((p) => callerGranted.has(p))
      ) as Set<MotherPermission>;

      const childRegistry = new RegistryClass();
      const childApi = createChildApi({
        moduleId: mod.id,
        manifestPermissions: mod.manifest.permissions,
        granted: childGranted,
        allowNetworkFetch,
        registry: childRegistry,
        callDepth: callDepth + 1,
      });

      try {
        return await runAction(compiled.actions, action, childApi, input, initialState);
      } finally {
        await childRegistry.cleanupAll();
      }
    },
  };
}
