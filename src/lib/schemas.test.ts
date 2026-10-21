import { describe, expect, it } from "vitest";
import { bookingCreateSchema } from "./schemas";

const base = {
  creatorSlug: "zay-yar-min",
  start: "2026-10-22T10:30:00+04:00",
  agentId: "5fc4d778-5ef4-4a37-b6e8-6ba640f1d2f7",
  projectName: "Emaar",
  locationType: "office" as const,
};

describe("bookingCreateSchema video count", () => {
  it("requires a count for video and photo + video shoots", () => {
    expect(bookingCreateSchema.safeParse({ ...base, shootType: "video" }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...base, shootType: "photo_video" }).success).toBe(false);
  });

  it("accepts a count from 1 to 20", () => {
    expect(bookingCreateSchema.safeParse({ ...base, shootType: "video", expectedVideos: 3 }).success).toBe(true);
    expect(bookingCreateSchema.safeParse({ ...base, shootType: "video", expectedVideos: 0 }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...base, shootType: "video", expectedVideos: 21 }).success).toBe(false);
  });

  it("doesn't ask for one on a photo shoot", () => {
    expect(bookingCreateSchema.safeParse({ ...base, shootType: "photo" }).success).toBe(true);
  });
});
