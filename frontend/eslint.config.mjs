import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // The dashboard intentionally loads and refreshes remote state from effects.
      // Keep the established React 18 lifecycle behavior during the Next.js 16 migration.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next-dev/**",
    ".next-build/**",
    "out/**",
    ".npm-*-cache/**",
    "next-env.d.ts",
  ]),
]);
