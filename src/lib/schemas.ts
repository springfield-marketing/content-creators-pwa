// Zod schemas for all API inputs (§B1: every mutation is validated).

import { z } from "zod";

export const agentCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional(),
  office: z.string().trim().max(120).optional(),
});

export const bookingCreateSchema = z
  .object({
    creatorSlug: z.string().trim().min(1).max(100),
    shootType: z.enum(["photo", "video", "photo_video"]),
    start: z.string().datetime({ offset: true }),
    agentId: z.string().uuid(),
    projectName: z.string().trim().min(1).max(200),
    locationType: z.enum(["on_site", "office"]),
    propertyAddress: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => v.locationType === "office" || !!v.propertyAddress?.trim(),
    { message: "Property address is required for on-site shoots", path: ["propertyAddress"] }
  );

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
