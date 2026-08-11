import { z } from 'zod'

export const appErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional()
})

export type AppError = z.infer<typeof appErrorSchema>

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export const err = (
  code: string,
  message: string,
  retryable = false,
  details?: Record<string, unknown>
): Result<never> => ({
  ok: false,
  error: details === undefined ? { code, message, retryable } : { code, message, retryable, details }
})

export const toAppError = (cause: unknown, fallbackCode = 'INTERNAL_ERROR'): AppError => {
  if (cause instanceof Error) {
    return { code: fallbackCode, message: cause.message, retryable: false }
  }
  return { code: fallbackCode, message: 'Falha interna não identificada.', retryable: false }
}
