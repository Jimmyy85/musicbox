/** @type {import('next').NextConfig} */
const nextConfig = {
    // 1. Autoriser les images externes (Deezer, etc.)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'e-cdns-images.dzcdn.net',
            },
            {
                protocol: 'https',
                hostname: 'api.deezer.com',
            },
            {
                protocol: 'https',
                hostname: 'api.dicebear.com',
            },
        ],
        unoptimized: true, // Important pour éviter certains bugs d'affichage
    },

    // 2. LE FAMEUX TUNNEL (Rewrites)
    // C'est ça qui transforme /api/deezer en https://api.deezer.com
    async rewrites() {
        return [
            {
                source: '/api/deezer/:path*',
                destination: 'https://api.deezer.com/:path*',
            },
        ];
    },
};

export default nextConfig;