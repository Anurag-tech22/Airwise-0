// Performance budgets (gzipped JavaScript): fails the build if the first page load or the total grows too large.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const INITIAL_LIMIT_KB = 105; // what every visitor downloads before the page is usable
const TOTAL_LIMIT_KB = 110; // everything, including any lazily loaded chunks
const dist = new URL("../dist/", import.meta.url);
const gz = (file: string) => gzipSync(readFileSync(new URL(file, dist))).length / 1024;

const html = readFileSync(new URL("index.html", dist), "utf8");
const initialFiles = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1] as string),
);
const allFiles = readdirSync(new URL("assets/", dist))
  .filter((f) => f.endsWith(".js"))
  .map((f) => `assets/${f}`);
const initial = [...initialFiles].reduce((sum, f) => sum + gz(f), 0);
const total = allFiles.reduce((sum, f) => sum + gz(f), 0);

console.log(
  `JS gzip — first load: ${initial.toFixed(1)} kB (budget ${INITIAL_LIMIT_KB}) · total: ${total.toFixed(1)} kB (budget ${TOTAL_LIMIT_KB})`,
);
if (initial > INITIAL_LIMIT_KB || total > TOTAL_LIMIT_KB) {
  console.error("Performance budget exceeded.");
  process.exit(1);
}
