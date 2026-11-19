import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Fotos oficiais de deputados e senadores
    remotePatterns: [
      { protocol: 'https', hostname: 'www.camara.leg.br' },
      { protocol: 'https', hostname: 'legis.senado.leg.br' },
    ],
  },
};

export default nextConfig;
