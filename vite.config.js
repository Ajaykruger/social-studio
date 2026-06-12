import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Decision API + campaign artifacts come from the local decision server
      // (npm run serve). It is localhost-only and makes no Postiz calls.
      "/api": "http://127.0.0.1:4810",
      "/studio-data": "http://127.0.0.1:4810"
    }
  }
});
