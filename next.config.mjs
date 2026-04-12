/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./i18n/request.js');

const nextConfig = {
  webpack(config) {
    // Ensure .jsx extensions are resolved automatically
    if (!config.resolve.extensions.includes('.jsx')) {
      config.resolve.extensions.push('.jsx');
    }

    // Explicitly map the "@" alias to the project root
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
    };

    // Safe SVG handling compatible with Next 15
    const existingSvgRule = config.module.rules.find(
      (rule) => rule && rule.test instanceof RegExp && rule.test.test('.svg'),
    );

    // Keep url() imports as files (e.g. import icon from 'icon.svg?url')
    config.module.rules.push({
      test: /\.svg$/i,
      resourceQuery: /url/,
      type: 'asset/resource',
    });

    // All other .svg imports become React components via SVGR
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      resourceQuery: { not: [/url/] },
      use: ['@svgr/webpack'],
    });

    // Exclude SVG from any pre-existing asset rule if found
    if (existingSvgRule) {
      existingSvgRule.exclude = /\.svg$/i;
    }

    return config;
  },
  // Allow larger file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    middlewareClientMaxBodySize: '50mb',
  },
};

export default withNextIntl(nextConfig);
