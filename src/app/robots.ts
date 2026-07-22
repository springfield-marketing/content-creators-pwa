import type { MetadataRoute } from "next";

// Strictly internal tool — disallow all crawling. Paired with the noindex meta
// tag in the root layout metadata.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
