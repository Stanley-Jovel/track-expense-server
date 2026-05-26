import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'ai',
    '@ai-sdk/groq',
    '@ai-sdk/deepseek',
    '@ai-sdk/mistral',
    '@ai-sdk/openai',
  ],
  webpack: (config) => {
    // buffer-equal-constant-time@1.0.1 (pulled in by google-auth-library via
    // jws → jwa) references the removed Buffer.SlowBuffer at module load,
    // which crashes on Node 22+. Alias it to an in-repo shim.
    config.resolve.alias = {
      ...config.resolve.alias,
      'buffer-equal-constant-time': path.resolve(
        __dirname,
        'lib/buffer-equal-constant-time-shim.js'
      ),
    };
    return config;
  },
};

export default nextConfig;
