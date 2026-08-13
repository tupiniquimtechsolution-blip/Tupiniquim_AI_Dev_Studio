import { z } from 'zod'

export const previewStartInputSchema = z.object({ kind: z.literal('VITE'), relativePath: z.string().max(4096).default(''), width: z.number().int().min(320).max(3840).default(1280), height: z.number().int().min(480).max(2160).default(800) })
export const previewSessionInputSchema = z.object({ previewId: z.string().uuid() })
export const previewResizeInputSchema = previewSessionInputSchema.extend({ width: z.number().int().min(320).max(3840), height: z.number().int().min(480).max(2160) })

export interface PreviewSession { id: string; kind: 'VITE'; url: string; cwd: string; pid: number; startedAt: string; width: number; height: number }
export interface PreviewEvent { previewId: string; kind: 'OUTPUT' | 'READY' | 'EXIT' | 'ERROR'; at: string; detail: string }
