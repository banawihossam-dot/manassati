// يُنشر الموقع على GitHub Pages كملفات ثابتة تحت المسار /manassati
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/manassati' : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  reactStrictMode: false,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
};
export default nextConfig;
