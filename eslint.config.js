const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

// Two type-checked scopes, mirroring the two tsconfigs in this repo:
// - src/** (excluding webview-ui) + test/** against tsconfig.eslint.json
//   (a lint-only superset of tsconfig.json that also includes test/,
//   which the build's tsconfig.json deliberately excludes).
// - src/webview-ui/** against tsconfig.webview.json (module: "none", no
//   bundler — its necessary duplication of types/logic from main.ts's
//   peers is intentional, see ADR-0003, not something to "fix" here).
module.exports = tseslint.config(
  { ignores: ["dist/**", "*.vsix"] },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    ignores: ["src/webview-ui/**"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      eqeqeq: "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Two vitest-specific false-positive sources, scoped to test files
    // only (src/ keeps full type-aware strictness):
    // - expect(mockObject.method).toHaveBeenCalledWith(...), the standard
    //   mock-assertion pattern used throughout this suite, reads a method
    //   off an object without calling it — indistinguishable to this rule
    //   from an actually unbound method call.
    // - expect.stringMatching(...) and friends type as `any` in vitest's
    //   own type defs, so assigning one into a typed object literal always
    //   trips no-unsafe-assignment regardless of how the test is written.
    files: ["test/**/*.ts"],
    // - vi.fn() without explicit generics types .mock.calls as `any[][]`,
    //   so inspecting a captured call's raw argument object (e.g. to
    //   assert a field that isn't covered by toHaveBeenCalledWith) trips
    //   no-unsafe-member-access on every step of the chain.
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["src/webview-ui/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.webview.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      eqeqeq: "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  eslintConfigPrettier,
);
