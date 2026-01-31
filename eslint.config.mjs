// eslint.config.mjs
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "eslint-config-next";

export default tseslint.config(
  {
    // Global ignores for the entire project
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "**/node_modules/**"],
  },
  eslint.configs.recommended, // ESLint's recommended rules
  ...tseslint.configs.recommended, // TypeScript ESLint's recommended rules
  ...nextPlugin, // Next.js recommended rules (includes React and React Hooks)
  {
    // Custom rules or overrides for specific file types
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // Add or override any specific rules here
      // Example: 'react/react-in-jsx-scope': 'off', // Not needed for Next.js 13+
      // 'react/display-name': 'off',
    },
  },
  {
    // Configuration for JavaScript files that might still exist (e.g., config files)
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    rules: {
      // Add any specific rules for JS files if needed
    },
  },
);
