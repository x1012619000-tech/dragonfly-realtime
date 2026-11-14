// Regenerates worker/src/seed.js from the site's seed (single source of truth).
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const seed = require("../../docs/js/seed.js");
fs.writeFileSync(new URL("../src/seed.js", import.meta.url), "// AUTO-GENERATED from docs/js/seed.js — run `node scripts/build-seed.mjs`\nexport default " + JSON.stringify(seed, null, 2) + ";\n");
console.log("seed.js written");
