// Shared labels for the DB shoot_type enum.

export type DbShootType = "photo" | "video" | "photo_video";

export const dbShootTypeLabel: Record<DbShootType, string> = {
  photo: "Photo",
  video: "Video",
  photo_video: "Photo + Video",
};

export const isDbShootType = (v: string): v is DbShootType =>
  v === "photo" || v === "video" || v === "photo_video";
