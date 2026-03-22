import { z } from 'zod';

export const sourceKindSchema = z.enum(['event', 'venue', 'custom']);

export const finalizedOptionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  suggested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggested_time: z.string().regex(/^\d{2}:\d{2}$/),
  rank: z.number().int().min(1).max(3),
  source_kind: sourceKindSchema,
  source_id: z
    .union([z.string().min(1), z.literal(''), z.null()])
    .transform((value) => (value === '' ? null : value)),
  weather_note: z.string().min(1).nullable().optional(),
});

export const finalizedOptionsSchema = z.object({
  options: z.array(finalizedOptionSchema).length(3),
});

export const emptyToolInputSchema = z.object({});

export const listCandidatesInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const listDateOverlapsInputSchema = z.object({
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export type FinalizedOption = z.infer<typeof finalizedOptionSchema>;
export type FinalizedOptions = z.infer<typeof finalizedOptionsSchema>;
