/* Проверка целостности дизайн-системы.
 *
 * 1. Каждый .jsx компонента парсится и исполняется — ловит синтаксис и ссылки
 *    на необъявленные идентификаторы (tsc внутрь .jsx не смотрит, а vite build
 *    не тянет то, что нигде не импортировано).
 * 2. Экспорты .jsx сверяются с объявлениями в сайдкаре .d.ts.
 * 3. Все имена иконок, встречающиеся в src/, проверяются по icon-data.js.
 *
 * Запуск: npm run check
 */
import { build } from "esbuild";
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DS = join(ROOT, "src", "ds");

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (entry.endsWith(ext)) out.push(p);
  }
  return out;
}

const problems = [];
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

/* ---------- 1 + 2. Компоненты: сборка, рендер, сверка с .d.ts ---------- */

const components = walk(join(DS, "components"), ".jsx").sort();
const imports = [];
const checks = [];

components.forEach((file, i) => {
  const spec = "./" + rel(file);
  imports.push(`import * as m${i} from ${JSON.stringify(spec)};`);
  checks.push(`  [${JSON.stringify(rel(file))}, m${i}],`);
});

const entry = `
${imports.join("\n")}
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
const mods = [
${checks.join("\n")}
];
const out = [];
for (const [path, mod] of mods) {
  const names = Object.keys(mod);
  const rendered = [];
  for (const name of names) {
    const value = mod[name];
    if (typeof value !== 'function') continue;
    if (/^use[A-Z]/.test(name)) continue;   // хук, а не компонент — рендерить нечего
    try { renderToStaticMarkup(React.createElement(value)); rendered.push(name); }
    catch (e) { out.push({ path, name, error: String(e && e.message || e) }); }
  }
  out.push({ path, names, rendered });
}
console.log('__RESULT__' + JSON.stringify(out));
`;

const tmp = join(ROOT, "._check.cjs");
await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "jsx" },
  bundle: true,
  outfile: tmp,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  logLevel: "error",
  banner: { js: "global.window = global.window || {}; global.document = global.document || { currentScript: null };" },
});

const { execFileSync } = await import("node:child_process");
let raw = "";
try {
  raw = execFileSync(process.execPath, [tmp], { encoding: "utf8" });
} catch (e) {
  problems.push(`не удалось выполнить сборку компонентов: ${e.message}`);
} finally {
  try { unlinkSync(tmp); } catch { /* уже удалён */ }
}

const line = raw.split("\n").find((l) => l.startsWith("__RESULT__"));
const results = line ? JSON.parse(line.slice("__RESULT__".length)) : [];

for (const r of results) {
  if (r.error) {
    problems.push(`${r.path}: ${r.name} не рендерится с пустыми пропсами — ${r.error}`);
    continue;
  }
  const dts = r.path.replace(/\.jsx$/, ".d.ts");
  let declared;
  try {
    declared = readFileSync(join(ROOT, dts), "utf8");
  } catch {
    problems.push(`${r.path}: нет сайдкара ${dts}`);
    continue;
  }
  const declaredNames = [...declared.matchAll(/^export declare (?:function|const)\s+(\w+)/gm)].map((m) => m[1]);
  const missing = declaredNames.filter((n) => !r.names.includes(n));
  if (missing.length) {
    problems.push(`${r.path}: .d.ts объявляет ${missing.join(", ")}, но .jsx это не экспортирует`);
  }
}

/* ---------- 3. Имена иконок ---------- */

const iconData = readFileSync(join(DS, "assets", "icons", "icon-data.js"), "utf8");
const known = new Set([...iconData.matchAll(/^ {2}"([A-Za-z0-9_]+)": \{/gm)].map((m) => m[1]));

const sources = [...walk(join(ROOT, "src"), ".jsx"), ...walk(join(ROOT, "src"), ".tsx")];
for (const file of sources) {
  const src = readFileSync(file, "utf8");
  const used = new Set([...src.matchAll(/['"]([A-Za-z]+Size\d+[A-Za-z0-9]*)['"]/g)].map((m) => m[1]));
  for (const name of used) {
    if (!known.has(name)) problems.push(`${rel(file)}: иконки «${name}» нет в наборе`);
  }
}

const dtsNames = new Set(
  [...readFileSync(join(DS, "assets", "icons", "Icon.d.ts"), "utf8").matchAll(/\|\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1]),
);
for (const name of known) {
  if (!dtsNames.has(name)) problems.push(`Icon.d.ts: нет имени «${name}» из icon-data.js`);
}
for (const name of dtsNames) {
  if (!known.has(name)) problems.push(`Icon.d.ts: имя «${name}» объявлено, но данных для него нет`);
}

/* ---------- 4. Токены: компоненты не лезут в примитивы и не пишут hex ----------
 *
 * Тему переключает только слой --color-* (см. блок .dark в tokens/colors.css).
 * Компонент, который берёт --granat-* или --mgts-* напрямую, в тёмной теме
 * не перекрасится — поэтому такие обращения запрещены. Исключение — сами
 * токены и витрина, которая показывает палитру как есть.
 */

const PRIMITIVE = /var\(\s*--(granat|mgts)-[a-z0-9-]+\s*\)/g;
// #fff и #ffffff разрешены: белый не зависит от темы (текст на брендовой заливке).
const RAW_HEX = /#(?!fff)(?!ffffff)[0-9a-fA-F]{6}/g;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

for (const file of walk(join(DS, "components"), ".jsx")) {
  const src = stripComments(readFileSync(file, "utf8"));
  const prims = [...new Set([...src.matchAll(PRIMITIVE)].map((m) => m[0]))];
  if (prims.length) {
    problems.push(`${rel(file)}: обращение к примитивам вместо семантических токенов — ${prims.join(", ")}`);
  }
  const hexes = [...new Set([...src.matchAll(RAW_HEX)].map((m) => m[0]))];
  if (hexes.length) {
    problems.push(`${rel(file)}: hex в коде вместо токена — ${hexes.join(", ")}`);
  }
}

/* ---------- итог ---------- */

const rendered = results.reduce((n, r) => n + (r.rendered ? r.rendered.length : 0), 0);
console.log(`Компонентов-файлов: ${components.length}, экспортов отрисовано: ${rendered}`);
console.log(`Иконок в наборе: ${known.size}, имён в Icon.d.ts: ${dtsNames.size}`);

if (problems.length) {
  console.error(`\nПроблем: ${problems.length}`);
  for (const p of problems) console.error("  · " + p);
  process.exit(1);
}
console.log("\nПроверка пройдена.");
