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
  .object({ content: z.string().trim().min(1).max(20000) })
  .strict();
export interface CloudSession {
  id: string;
  title: string;
  startsAt: string | null;
  participantVisibility: 'everyone' | 'organizer_only';
  createdAt: string;
  participantCount: number;
}
