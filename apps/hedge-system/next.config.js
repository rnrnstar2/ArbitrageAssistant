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
  
  // 開発時のキャッシュ問題対策
  webpack: (config, { dev }) => {
    if (dev) {
      // watchOptionsでファイル変更の検知を改善
      config.watchOptions = {
        poll: 500, // 500msごとにファイル変更をチェック
        aggregateTimeout: 200, // 変更検知後200ms待ってから再ビルド
      };
      
      // モジュール解決のキャッシュを無効化
      config.resolve.symlinks = true;
    }
    return config;
  },
  
  // transpilePackagesで@repo/uiの変更を確実に検知
  transpilePackages: ['@repo/ui', '@repo/shared-amplify', '@repo/shared-auth'],
};

export default nextConfig;
