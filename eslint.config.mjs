import tseslint from "typescript-eslint"
import prettierPlugin from "eslint-plugin-prettier"

export default [
  {
    ignores: ["dist", ".medusa", "node_modules"],
  },
  {
    files: ["**/*.{ts,tsx,js}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierPlugin.configs.recommended.rules,
    },
  },
]
