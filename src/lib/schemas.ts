// Zod schemas for all API inputs (§B1: every mutation is validated).

import { z } from "zod";

export const agentCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional(),
  office: z.string().trim().max(120).optional(),
});

export const agentUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).nullable(),
    office: z.string().trim().max(120).nullable(),
    isApproved: z.boolean(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Empty update" });
