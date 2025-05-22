/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['cmm-cloud-2.s3.us-west-1.amazonaws.com'],
  },
  // Enable static file serving for audio and video files
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 