import { z } from 'zod';
export const participantVisibilitySchema = z.enum([
  'everyone',
  'organizer_only',
]);
export const sessionStateSchema = z.enum([
  'ready',
  'recording',
  'paused',
  'completed',
  'interrupted',
]);
export const sessionSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120),
  participantVisibility: participantVisibilitySchema.default('everyone'),
  state: sessionStateSchema,
  createdAt: z.iso.datetime(),
});
export type SessionState = z.infer<typeof sessionStateSchema>;
export type Session = z.infer<typeof sessionSchema>;
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  introduction: z.string().trim().min(1).max(160),
  workingOn: z.string().max(300).optional(),
  wantToDiscuss: z.string().max(300).optional(),
  wantToMeet: z.string().max(300).optional(),
  canDiscuss: z.string().max(300).optional(),
  organization: z.string().max(100).optional(),
  occupation: z.string().max(100).optional(),
  city: z.string().max(80).optional(),
  publicLink: z.url({ protocol: /^https?$/ }).optional(),
});
export type Profile = z.infer<typeof profileSchema>;

export const createSessionSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    startsAt: z.iso.datetime().nullable().optional(),
    participantVisibility: participantVisibilitySchema,
  })
  .strict();
export const updateSessionSchema = createSessionSchema
  .omit({ id: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, '请填写要更新的内容');
export const joinSessionSchema = z
  .object({ profile: profileSchema, saveProfile: z.boolean() })
  .strict();
export const publishRecapSchema = z
  .object({
    content: z.string().trim().min(1).max(20000),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();
export interface CloudSession {
  id: string;
  title: string;
  startsAt: string | null;
  participantVisibility: 'everyone' | 'organizer_only';
  createdAt: string;
  participantCount: number;
}

export const entrySchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    occurredAt: z.iso.datetime(),
    location: z.string().max(160).default(''),
    category: z.string().max(40).default(''),
    notes: z.string().max(20000).default(''),
    people: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(40),
            note: z.string().max(300).default(''),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    sessionId: z.uuid().nullable().default(null),
  })
  .strict();
export const updateEntrySchema = entrySchema
  .omit({ id: true })
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export type PersonalEntry = z.infer<typeof entrySchema> & {
  version: number;
  updatedAt: string;
};
export interface ActivityItem {
  id: string;
  title: string;
  occurredAt: string;
  relation: 'organizer' | 'participant' | 'private';
  sessionId: string | null;
  entryIds: string[];
}
export const syncFieldsSchema = z
  .array(z.enum(['summary', 'topics', 'actions', 'speakers', 'transcript']))
  .min(1)
  .max(5)
  .refine((v) => new Set(v).size === v.length);
export const privateAISchema = z
  .object({
    bindingId: z.uuid(),
    localSessionId: z.uuid(),
    sessionId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    sourceVersion: z.string().min(1).max(100),
    version: z.number().int().nonnegative(),
    fields: syncFieldsSchema,
    content: z
      .object({
        summary: z.string().max(100000).optional(),
        topics: z.array(z.string().max(1000)).max(100).optional(),
        actions: z.array(z.string().max(1000)).max(200).optional(),
        speakers: z
          .array(
            z
              .object({ id: z.string().max(100), label: z.string().max(100) })
              .strict(),
          )
          .max(500)
          .optional(),
        transcript: z
          .array(
            z
              .object({
                id: z.string().max(100),
                speakerId: z.string().max(100).nullable(),
                startMs: z.number().nonnegative(),
                endMs: z.number().nonnegative(),
                text: z.string().max(20000),
              })
              .strict(),
          )
          .max(20000)
          .optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const key of Object.keys(v.content))
      if (!v.fields.includes(key as (typeof v.fields)[number]))
        ctx.addIssue({ code: 'custom', message: '内容超出授权范围' });
    for (const key of v.fields)
      if (v.content[key] === undefined)
        ctx.addIssue({ code: 'custom', message: '缺少已授权字段' });
  });
export type PrivateAIInput = z.infer<typeof privateAISchema>;
