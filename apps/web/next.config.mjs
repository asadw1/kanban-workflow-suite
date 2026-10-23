/**
 * @file next.config.mjs
 * @description Next.js configuration for the web app.
 */

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Workspace packages ship compiled ESM, but transpiling keeps hot reload working when a
  // package is rebuilt in watch mode.
  transpilePackages: ["shared-types"],
  reactStrictMode: true,
  // Linting runs as its own Turborepo task (`pnpm lint`), so skip the duplicate pass in `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
