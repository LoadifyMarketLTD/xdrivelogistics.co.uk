/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['supabase.co'], // Add Supabase domain if using storage
  },
};

export default nextConfig;
