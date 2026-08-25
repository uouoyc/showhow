import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
  outputFileTracingExcludes: {
    "/*": ["./data/**/*"],
  },
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  reactCompiler: true,
};

export default nextConfig;
