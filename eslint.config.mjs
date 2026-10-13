// Lint for the system's modules and the dev harnesses: `npm run lint` (from dev/). Catches undefined names, unused code and likely mistakes without running anything.
// The tools live in dev/node_modules (the repo root is the Foundry system folder), so they are loaded from there.
import { createRequire } from "node:module";
const require = createRequire(new URL("./dev/package.json", import.meta.url));
const js = require("@eslint/js");
const globals = require("globals");

// What Foundry puts on `window` that the code reads as bare names.
const foundryGlobals = Object.fromEntries(["game", "canvas", "ui", "Hooks", "foundry", "CONFIG", "CONST", "Actor", "Item", "Roll", "ChatMessage", "Combat", "Folder",
  "fromUuid", "fromUuidSync", "Macro", "Scene", "Token", "TokenDocument", "ActiveEffect", "Handlebars", "FilePicker", "TextEditor", "Application", "ItemSheet", "ActorSheet",
  "MeasuredTemplate", "MeasuredTemplateDocument", "RegionDocument", "WallDocument", "Wall", "Combatant", "User", "JournalEntry", "PIXI", "loadTemplates", "renderTemplate",
  "Collection", "Sound"].map(n => [n, "readonly"]));

export default [
  { ignores: ["dev/node_modules/**", "module/trees.mjs", "module/combos.mjs", "module/mental-bold.mjs"] },     // generated from the docs
  js.configs.recommended,
  {
    files: ["module/**/*.mjs", "dev/tests/**/*.mjs", "dev/run-tests.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.browser, ...globals.node, ...foundryGlobals } },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-empty": "off",                       // `catch (err) { /* ... */ }` is deliberate
      "no-prototype-builtins": "off",
      "no-constant-condition": "off",
      "no-useless-escape": "off",
      "no-async-promise-executor": "off",
      "no-inner-declarations": "off"
    }
  },
  {
    // The harnesses reassign what they mock and keep scratch variables around.
    files: ["dev/tests/**/*.mjs"],
    rules: { "no-unused-vars": "off", "no-global-assign": "off", "no-undef": "warn" }
  }
];
