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
};

export default nextConfig;
