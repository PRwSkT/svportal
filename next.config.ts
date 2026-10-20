import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  }
];

const nextConfig: NextConfig = {
  typescript: {
    // Prevent Netlify build worker OOM (heap out of memory) during typecheck
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    localPatterns: [
      {
        pathname: '/**',
        search: '',
      },
      {
        pathname: '/**',
        search: '?*',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ufsqavndpjphowuacxfi.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
