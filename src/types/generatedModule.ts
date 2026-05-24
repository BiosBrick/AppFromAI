import { z, type ZodType } from 'zod';
import type { UiNode } from './uiNodes';

export const MOTHER_ALLOWED_PERMISSIONS = [
  'camera',
  'audioRecorder',
  'qrScanner',
  'torch',
  'location',
  'sensors',
  'linking',
  'storage',
  'network',
  'notifications',
] as const;

export type MotherPermission = (typeof MOTHER_ALLOWED_PERMISSIONS)[number];

export const manifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'id: lettere minuscole, numeri, - e _'),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'versione semver tipo 1.0.0'),
  runtime: z.literal('javascript'),
  permissions: z.array(z.enum(MOTHER_ALLOWED_PERMISSIONS)).default([]),
  entry: z.string().min(1),
  ui: z.string().min(1),
});

export type ModuleManifest = z.infer<typeof manifestSchema>;

const uiLayoutPropsSchema = z.object({
  flex: z.number().optional(),
  flexGrow: z.number().optional(),
  flexShrink: z.number().optional(),
  width: z.union([z.number(), z.string()]).optional(),
  minWidth: z.number().optional(),
  maxWidth: z.union([z.number(), z.string()]).optional(),
  alignSelf: z
    .enum(['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'])
    .optional(),
  marginTop: z.number().optional(),
  marginBottom: z.number().optional(),
  marginLeft: z.number().optional(),
  marginRight: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
});

const uiThemeSchema = z.object({
  bg: z.string().optional(),
  surface: z.string().optional(),
  border: z.string().optional(),
  primary: z.string().optional(),
  text: z.string().optional(),
  muted: z.string().optional(),
});

const uiStylePropsSchema = z.object({
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z
    .enum(['400', '500', '600', '700', '800', '900', 'bold', 'normal'])
    .optional(),
  borderRadius: z.number().optional(),
  padding: z.number().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  opacity: z.number().optional(),
});

export const uiNodeSchema: ZodType<UiNode> = z.lazy(() => {
  const navigatorScreenSchema = z.object({
    type: z.literal('screen'),
    title: z.string(),
    components: z.array(uiNodeSchema),
    gap: z.number().optional(),
    padding: z.number().optional(),
    theme: uiThemeSchema.optional(),
    onFocus: z.string().optional(),
  });

  return z.discriminatedUnion('type', [
    z.object({
      type: z.literal('navigator'),
      initialScreen: z.string(),
      theme: uiThemeSchema.optional(),
      screens: z.record(z.string(), navigatorScreenSchema),
    }),
    z.object({
      type: z.literal('screen'),
      title: z.string(),
      components: z.array(uiNodeSchema),
      gap: z.number().optional(),
      padding: z.number().optional(),
      theme: uiThemeSchema.optional(),
      onInit: z.string().optional(),
    }),
    z
      .object({
        type: z.literal('text'),
        id: z.string().optional(),
        text: z.string().optional(),
        bind: z.string().optional(),
        style: uiStylePropsSchema.optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('input'),
        id: z.string(),
        placeholder: z.string().optional(),
        bind: z.string(),
        keyboardType: z.enum(['default', 'numeric', 'decimal-pad']).optional(),
        style: uiStylePropsSchema.optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('textarea'),
        id: z.string(),
        placeholder: z.string().optional(),
        bind: z.string(),
        style: uiStylePropsSchema.optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('button'),
        id: z.string(),
        text: z.string(),
        action: z.string().optional(),
        navigate: z.string().optional(),
        actionInput: z.record(z.string(), z.unknown()).optional(),
        variant: z.enum(['primary', 'secondary', 'danger']).optional(),
        style: uiStylePropsSchema.optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('list'),
        id: z.string().optional(),
        bind: z.string(),
        emptyText: z.string().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z.object({
      type: z.literal('box'),
      id: z.string().optional(),
      direction: z.enum(['row', 'column']).optional(),
      gap: z.number().optional(),
      padding: z.number().optional(),
      wrap: z.boolean().optional(),
      alignItems: z
        .enum(['stretch', 'flex-start', 'flex-end', 'center', 'baseline'])
        .optional(),
      justifyContent: z
        .enum([
          'flex-start',
          'flex-end',
          'center',
          'space-between',
          'space-around',
          'space-evenly',
        ])
        .optional(),
      components: z.array(uiNodeSchema),
      layout: uiLayoutPropsSchema.optional(),
    }),
    z
      .object({
        type: z.literal('card'),
        id: z.string().optional(),
        components: z.array(uiNodeSchema),
        style: uiStylePropsSchema.optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('image'),
        id: z.string().optional(),
        bind: z.string(),
        height: z.number().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('audioRecorder'),
        id: z.string().optional(),
        statusBind: z.string().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('qrScanner'),
        id: z.string().optional(),
        hint: z.string().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('webGame'),
        id: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('gamepad'),
        id: z.string().optional(),
        direction: z.enum(['row', 'dpad', 'split']).optional(),
        buttons: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            action: z.string(),
            hold: z.boolean().optional(),
            holdMs: z.number().optional(),
            style: uiStylePropsSchema.optional(),
          })
        ),
        buttonSize: z.number().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
    z
      .object({
        type: z.literal('ticker'),
        id: z.string().optional(),
        tickMs: z.number().min(100),
        tickAction: z.string(),
        running: z.string().optional(),
      }),
    z
      .object({
        type: z.literal('gameView'),
        id: z.string().optional(),
        bind: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        tickMs: z.number().optional(),
        fps: z.number().min(10).max(60).optional(),
        tickAction: z.string().optional(),
        onTapAction: z.string().optional(),
        onSwipeAction: z.string().optional(),
      })
      .extend({ layout: uiLayoutPropsSchema.optional() }),
  ]);
});

export type { UiNode };

export const generatedModuleSchema = z.object({
  manifest: manifestSchema,
  ui: uiNodeSchema,
  code: z.string().min(1),
});

export type GeneratedModulePayload = z.infer<typeof generatedModuleSchema>;

export type StoredModule = {
  id: string;
  name: string;
  version: string;
  manifest: ModuleManifest;
  ui: UiNode;
  code: string;
  createdAt: string;
  permissions: MotherPermission[];
  prompt?: string;
};
