import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory confuses workspace detection.
  outputFileTracingRoot: path.join(__dirname),
  // Server actions default to a 1 MB body — topic material uploads carry PDFs.
  experimental: { serverActions: { bodySizeLimit: '25mb' } },
}

export default nextConfig
