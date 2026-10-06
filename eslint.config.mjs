import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// eslint-config-next already registers the jsx-a11y plugin but turns on only a handful of
// its rules. Layer the plugin's strict rule set on top (rules only, so the plugin is not
// registered twice).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["**/*.{jsx,tsx}"], rules: jsxA11y.flatConfigs.strict.rules },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "test-results/**", "playwright-report/**", "public/uploads/**"]),
]);
