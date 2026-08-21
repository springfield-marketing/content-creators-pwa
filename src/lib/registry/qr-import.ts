// Variants DLD issues for every permit. The Drive-folder helpers that lived
// here served the one-time import from the old sheet and did not come across.
/** Variants DLD issues for every permit. */
export const QR_VARIANTS = ["original", "facebook", "instagram", "twitter"] as const;

/** Reads the variant off "<project> - facebook.png", tolerating copy numbers. */
export function variantFromFileName(fileName: string): string | null {
  const stem = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .toLowerCase();
  return (
    QR_VARIANTS.find((v) => new RegExp(`[-_ ]${v}$`).test(stem)) ?? null
  );
}
