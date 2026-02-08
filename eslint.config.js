import js from "@eslint/js";

let tseslint = null;
try {
  tseslint = await import("typescript-eslint");
} catch {
  tseslint = null;
}

const baseConfig = [
  js.configs.recommended,
  {
    ignores: ["dist/", "node_modules/"],
  },
];

const ts = tseslint?.default ?? tseslint;

const finalConfig = !ts
  ? baseConfig
  : ts.config(
    ...baseConfig,
    ...ts.configs.recommended,
    {
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "warn",
      },
    }
  );

export default finalConfig;
