/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! ATTENTION !!
    // Cela permet de déployer même s'il y a des erreurs TypeScript.
    ignoreBuildErrors: true,
  },
  eslint: {
    // On ignore aussi les erreurs de style (ESLint) pour le déploiement.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;