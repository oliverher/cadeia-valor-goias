import type { NextConfig } from "next";

// Publicação estática no GitHub Pages: https://oliverher.github.io/cadeia-valor-goias
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
