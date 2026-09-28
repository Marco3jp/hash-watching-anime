import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // プロジェクトページは https://marco3jp.github.io/hash-watching-anime/
  // Actions 上だけサブパスにする。ローカルの dev とスクショはルートのまま。
  base: process.env.GITHUB_ACTIONS ? "/hash-watching-anime/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 43123,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 43123,
    strictPort: true,
  },
});
