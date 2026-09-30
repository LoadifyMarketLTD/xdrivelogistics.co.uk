/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Signed legal PDFs read these two multilingual font files at request time.
  // Explicit tracing is required because the path is assembled dynamically.
  outputFileTracingIncludes: {
    '/api/account/legal-agreements': ['./node_modules/@fontsource/inter/files/inter-latin-ext-{400,700}-normal.woff'],
    '/api/onboarding/init': ['./node_modules/@fontsource/inter/files/inter-latin-ext-{400,700}-normal.woff'],
  },
  // Keep metadata in the initial document head for every user agent. Lighthouse
  // 13+ identifies as ordinary Chrome, so user-agent allowlists cannot reliably
  // detect it and may cause title/description/robots/manifest to arrive too late
  // for deterministic SEO audits. XDrive's root metadata is static, so disabling
  // metadata streaming avoids that race without changing the rendered content.
  htmlLimitedBots: /.*/,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.pixabay.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          }
        ]
      }
    ]
  }
};
export default nextConfig;
