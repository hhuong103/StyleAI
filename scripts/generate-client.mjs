import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, "packages/api-client/schema.d.ts");
const result = spawnSync(process.execPath, [
  path.join(root, "apps/web/node_modules/openapi-typescript/bin/cli.js"),
  path.join(root, "contracts/openapi.json"), "-o", output,
], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
// Keep the web Docker context self-contained; both files come from one generator.
copyFileSync(output, path.join(root, "apps/web/src/lib/schema.d.ts"));
