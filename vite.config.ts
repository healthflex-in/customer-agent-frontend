import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { resolveRuntimeEndpoints } from "./src/config/policy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnvironment = loadEnv(mode, process.cwd(), "VITE_");
  const environment = { ...fileEnvironment, ...process.env };
  resolveRuntimeEndpoints({
    VITE_APP_ENV: environment.VITE_APP_ENV,
    VITE_API_URL: environment.VITE_API_URL,
    VITE_WS_URL: environment.VITE_WS_URL,
    VITE_GRAPHQL_URL: environment.VITE_GRAPHQL_URL,
    VITE_CONSENT_URL: environment.VITE_CONSENT_URL,
  });

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
