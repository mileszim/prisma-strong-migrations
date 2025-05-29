import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "src/__tests__/**/*",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Specific overrides and configurations for TypeScript files
  {
    files: ["**/*.{ts,mts,cts}"],
    rules: {
      // only warn on no-explicit-any
      "@typescript-eslint/no-explicit-any": "warn",

      // Configure no-unused-vars for TypeScript
      // This overrides the setting from tseslint.configs.recommended for these files
      "@typescript-eslint/no-unused-vars": [
        "error", // Keep the severity as error for other unused variables
        {
          "varsIgnorePattern": "^_",                // Ignore variables like _foo
          "argsIgnorePattern": "^_",                // Ignore arguments like function foo(_bar)
          "caughtErrorsIgnorePattern": "^_",       // Ignore caught errors like catch (_e)
          "destructuredArrayIgnorePattern": "^_"   // Ignore in array destructuring like const [_, b] = arr;
        }
      ]
    },
  },
];
