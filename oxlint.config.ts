import { defineConfig } from "oxlint";

/**
 * Lint and type check of the TypeScript in the repository, one pass from the root (`nub run lint:code`): `typeAware`
 * and `typeCheck` make every run type-aware, against `tsconfig.json`. Everything here runs on Node: the configurations,
 * `scripts/` and the scripts of the agent skills.
 */
export default defineConfig({
  plugins: ["typescript", "unicorn", "import", "jsdoc"],
  options: {
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  },
  env: {
    builtin: true,
    es2026: true,
    node: true,
  },
  rules: {
    // Docblocks are prose (see CONTRIBUTING.md); when one carries tags, the tags are well formed. Nothing here demands
    // a tag, and nothing asks for types in them: the signature has those.
    "jsdoc/check-access": "error",
    "jsdoc/check-property-names": "error",
    "jsdoc/check-tag-names": "error",
    "jsdoc/empty-tags": "error",
    "jsdoc/implements-on-classes": "error",
    "jsdoc/no-blank-blocks": "error",
    "jsdoc/no-defaults": "error",
    "jsdoc/require-param-description": "error",
    "jsdoc/require-param-name": "error",
    "jsdoc/require-property-description": "error",
    "jsdoc/require-property-name": "error",
    "jsdoc/require-returns-description": "error",
    "jsdoc/require-throws-description": "error",
    "jsdoc/require-yields-description": "error",
  },
  ignorePatterns: [
    "**/node_modules/**",
    "build/**",
    "qmk_firmware/**",
    // The symlink to `.agents/skills`: the same files again, reached by a path no tsconfig covers.
    ".claude/**",
  ],
});
