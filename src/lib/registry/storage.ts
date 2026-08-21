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
 * The store holding permit QR images — `project-tracker-blob`, which already
 * holds 1,523 of them.
 *
 * This has to be explicit. Two blob stores are connected to this project, and
 * under OIDC the SDK picks whichever `BLOB_STORE_ID` names — which is this
 * app's own store, not the permit one. Without pinning it, QR codes issued
 * from here would land in a different store from every QR code issued before,
 * and the "empty" store would quietly stop being empty, so deleting it later
 * as unused would destroy live permits.
 *
 * Vercel generated BLOB_STORE_ID_BOOKING_STORE_ID when the store was connected.
 * PERMIT_BLOB_STORE_ID overrides it if that name ever changes.
 */
const PERMIT_STORE_ID =
  process.env.PERMIT_BLOB_STORE_ID ??
  process.env.BLOB_STORE_ID_BOOKING_STORE_ID;

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
      // Omitted rather than passed as undefined when unset, so local runs with
      // a plain BLOB_READ_WRITE_TOKEN still work.
      ...(PERMIT_STORE_ID ? { storeId: PERMIT_STORE_ID } : {}),
    },
  );
  return url;
}
