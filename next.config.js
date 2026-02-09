/** @type {import('next').NextConfig} */
const nextConfig = {
    // Cette partie autorise les images externes
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'e-cdns-images.dzcdn.net' },
            { protocol: 'https', hostname: 'api.deezer.com' },
            { protocol: 'https', hostname: 'api.dicebear.com' },
        ],
        unoptimized: true,
    },
    // Cette partie crée le "Tunnel" pour éviter le blocage CORS
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