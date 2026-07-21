import { defineConfig } from "@vite-pwa/assets-generator/config";

/**
 * Generates the PWA icons referenced by the manifest (see vite.config.ts) from
 * the app logo. Run with: bun run generate-pwa-assets
 *
 * Output names are pinned to match the existing manifest:
 *   transparent 192/512 -> icon-192.png / icon-512.png
 *   maskable    512      -> icon-maskable.png (dark full-bleed + safe-zone padding)
 */
export default defineConfig({
  images: ["public/favicon.svg"],
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: { sizes: [192, 512], padding: 0, favicons: [] },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: "#0B0E17" } },
    apple: { sizes: [] },
    assetName: (type, size) =>
      type === "maskable" ? "icon-maskable.png" : `icon-${size.width}.png`,
  },
});
