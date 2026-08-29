import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory confuses workspace detection.
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
