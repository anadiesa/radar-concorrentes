import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Importação de CSV (até 4 MB) passa por server action; o padrão é 1 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;

// Permite usar os bindings da Cloudflare no `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
