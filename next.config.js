/** @type {import('next').NextConfig} */
const nextConfig = {
  // enable React Strict Mode if you want runtime checks in development
  reactStrictMode: true,

  redirects() {
    return [
      {
        source: '/docs',
        destination: 'https://docs.netlify.com/frameworks/next-js/overview/',
        permanent: false,
      },
      {
        source: '/old-blog/:slug',
        destination: '/classics',
        permanent: true,
      },
      {
        source: '/github',
        destination: 'https://github.com/netlify-templates/next-platform-starter',
        permanent: false,
      },
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  rewrites() {
    return [
      {
        source: '/api/health',
        destination: '/quotes/random',
      },
      {
        source: '/blog',
        destination: '/classics',
      },
    ];
  },

  // Example: enable SWC styled-components transform if needed
  // compiler: {
  //   styledComponents: true,
  // },
};

export default nextConfig;
