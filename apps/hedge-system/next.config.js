/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-alert-dialog',
      '@tauri-apps/api',
      'zod',
    ],
  },
  
  images: {
    unoptimized: true, // Tauri環境用
  },
};

export default nextConfig;
