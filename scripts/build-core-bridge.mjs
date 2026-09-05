import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const PARTS_DIR = path.join(ROOT, "bridge_parts");
const OUTPUT = path.join(ROOT, "src", "Aiforge_Core_Bridge_v0.1.jsx");
const EXPECTED_SHA256 = "1a43a0a0993cc43c280f3ee58cd5f900dc73c9b8a1e15859b6acf46c1a3dc25d";

const parts = fs.readdirSync(PARTS_DIR)
  .filter(name => /^core_bridge\.part\d+$/.test(name))
  .sort();

if (parts.length !== 8) {
  throw new Error(`Expected 8 core bridge parts, found ${parts.length}.`);
}

const source = parts
  .map(name => fs.readFileSync(path.join(PARTS_DIR, name), "utf8"))
  .join("");

const hash = crypto.createHash("sha256").update(source, "utf8").digest("hex");

if (hash !== EXPECTED_SHA256) {
  throw new Error(`Core bridge hash mismatch. Expected ${EXPECTED_SHA256}, got ${hash}`);
}

fs.writeFileSync(OUTPUT, source, "utf8");
console.log(`PASS — core bridge rebuilt: ${hash}`);
