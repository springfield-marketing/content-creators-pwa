import path from "node:path";
import { put } from "@vercel/blob";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const QR_TYPES = ["image/png", "image/jpeg"];

export function checkUpload(file: File): string | null {
  if (!QR_TYPES.includes(file.type))
    return `${file.name} is not a PNG or JPG.`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is over 10 MB.`;
  return null;
}

/**
 * Writes an upload to Vercel Blob and returns its public CDN URL.
 *
 * The store is public so WordPress can embed the QR directly in an img tag,
 * rather than every view costing a function invocation.
 *
 * `addRandomSuffix` keeps blobs immutable: re-issuing a permit writes a new
 * object instead of overwriting, so a stale copy can never be served from
 * cache while the new one propagates.
 */
export async function saveUpload(
  file: File,
  projectId: number,
  permitNumber: string,
  variant: string,
): Promise<string> {
  const ext = path.extname(file.name).toLowerCase() || ".png";
  const { url } = await put(
    `permits/${projectId}/${permitNumber}-${variant}${ext}`,
    file,
    {
      access: "public",
      addRandomSuffix: true,
      // Permits are fixed once issued, so let the CDN hold them for a year.
      cacheControlMaxAge: 31_536_000,
    },
  );
  return url;
}
