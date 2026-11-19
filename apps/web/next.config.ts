import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Fotos oficiais dos deputados
    remotePatterns: [{ protocol: 'https', hostname: 'www.camara.leg.br' }],
  },
};

export default nextConfig;
