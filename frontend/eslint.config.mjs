import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import i18next from "eslint-plugin-i18next";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // UI text must come from messages/*.json (next-intl), never JSX literals.
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**", "src/app/[[]locale]/design/**", "src/**/*.test.tsx"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-text-only",
          "jsx-attributes": { include: ["alt", "aria-label", "title", "placeholder"] },
          words: { exclude: ["Jeparla", "[0-9!-/:-@[-`{-~]+", "[A-Z_-]+"] },
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
