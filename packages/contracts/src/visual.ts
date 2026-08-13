import { z } from 'zod'

export const visualProviderIds = ['YANDEX_IMAGES', 'MAGNIFIC', 'EVERYPIXEL', 'KREA', 'FONTJOY', 'HAIKEI', 'STILLS', 'SPOT_DSGN'] as const
export const visualProviderIdSchema = z.enum(visualProviderIds)
export type VisualProviderId = z.infer<typeof visualProviderIdSchema>

export const visualProviderStatusSchema = z.object({
  id: visualProviderIdSchema,
  label: z.string(),
  state: z.enum(['READY', 'NOT_CONFIGURED', 'ASSISTED_DEEP_LINK', 'LICENSE_REQUIRED']),
  kind: z.enum(['API', 'ASSISTED']),
  url: z.url(),
  detail: z.string()
})
export type VisualProviderStatus = z.infer<typeof visualProviderStatusSchema>

export const visualAssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  localPath: z.string().min(3).max(4096),
  sourceUrl: z.url(),
  provider: visualProviderIdSchema,
  license: z.enum(['KNOWN', 'UNKNOWN', 'RESTRICTED']),
  licenseName: z.string().nullable(),
  attribution: z.string().nullable(),
  rightsNote: z.string().min(1).max(2000),
  createdAt: z.string().datetime()
})
export type VisualAsset = z.infer<typeof visualAssetSchema>

export const visualAssetAddInputSchema = visualAssetSchema.omit({ id: true, createdAt: true })
export const visualAssetUseInputSchema = z.object({ assetId: z.string().uuid() })
export const visualProviderOpenInputSchema = z.object({ provider: visualProviderIdSchema })
