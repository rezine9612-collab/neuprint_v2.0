/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We serve the UI as prebuilt HTML in /public
  experimental: {
    serverActions: { allowedOrigins: [] }
  }
};

export default nextConfig;
