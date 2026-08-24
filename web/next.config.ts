import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
