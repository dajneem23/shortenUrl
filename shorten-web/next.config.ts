import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // API is on the same domain behind Traefik, so relative URLs work.
};

export default nextConfig;
