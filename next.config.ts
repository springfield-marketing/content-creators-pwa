import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creator photos uploaded via /admin/creators live in Vercel Blob; the
  // originals shipped in public/ stay local paths.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  // The TV leaderboard is a standalone static page (public/leaderboard.html) —
  // its own HTML/CSS/JS, none of the app bundle. Serve it at a clean URL.
  async rewrites() {
    return [{ source: "/leaderboard", destination: "/leaderboard.html" }];
  },
  // General permits moved next to the offplan registry, so there is one place
  // to look for a permit. This URL was bookmarked and linked from the
  // lapsing-permit banner for months.
  //
  // Config rather than a page calling redirect(): under the admin shell that
  // rendered the layout and returned 200 instead of redirecting, and a moved
  // URL should not depend on a component rendering at all.
  async redirects() {
    return [
      {
        source: "/admin/permits",
        destination: "/permits/general",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
