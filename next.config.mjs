/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    /**
     * Enables `instrumentation.ts`, which is where Sentry is initialised for
     * the Node and edge runtimes. Required in Next 14; the default in 15.
     */
    instrumentationHook: true,
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
    /**
     * Load Sentry as a plain Node dependency instead of bundling it.
     *
     * @sentry/nextjs pulls in OpenTelemetry, which does a dynamic
     * `require(expression)` that webpack cannot statically analyse — producing a
     * "Critical dependency: the request of a dependency is an expression"
     * warning on every build. Leaving it external sidesteps the bundling
     * entirely. Server-only, so it never reaches a client or edge bundle.
     */
    serverComponentsExternalPackages: ["@sentry/nextjs"],
  },
};

export default nextConfig;
