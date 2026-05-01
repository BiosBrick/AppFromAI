import type { GeneratedModulePayload, StoredModule } from '../types/generatedModule';

export type GenerateModuleResult =
  | { ok: true; module: GeneratedModulePayload }
  | { ok: false; error: string };

export type ModuleListItem = Pick<
  StoredModule,
  'id' | 'name' | 'version' | 'createdAt' | 'permissions'
>;

export const STORAGE_KEY = 'genapp:modules:v1';
