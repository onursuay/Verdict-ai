import { test } from "node:test";
import { strict as assert } from "node:assert";
import { tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runLocalPathSource } from "../sources/local-path";

function makeTempProject(): { root: string } {
  const root = mkdtempSync(path.join(tmpdir(), "verdict-local-"));
  mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  writeFileSync(path.join(root, "src", "lib", "engine.ts"), "export const x = 1;\n");
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "tmp" }));
  // node_modules — exclude edilmeli
  mkdirSync(path.join(root, "node_modules", "junk"), { recursive: true });
  writeFileSync(path.join(root, "node_modules", "junk", "leak.ts"), "DO NOT READ");
  return { root };
}

test("local-path: not_configured when env missing", async () => {
  const orig = process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
  delete process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
  const r = await runLocalPathSource({ selected: true, critical: false, localPath: "/tmp/whatever" });
  assert.equal(r.status, "not_configured");
  if (orig !== undefined) process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES = orig;
});

test("local-path: traversal blocked outside allowed prefix", async () => {
  const orig = process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
  process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES = "/non/existing/prefix";
  const r = await runLocalPathSource({ selected: true, critical: false, localPath: "/etc" });
  assert.equal(r.status, "unauthorized");
  if (orig !== undefined) process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES = orig;
  else delete process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
});

test("local-path: reads files within allowed prefix and excludes node_modules", async () => {
  const { root } = makeTempProject();
  const orig = process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
  process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES = root;
  const r = await runLocalPathSource({ selected: true, critical: false, localPath: root });
  assert.equal(r.status, "completed");
  assert.ok(r.fileCount! >= 2);
  // node_modules dosyası listede olmamalı
  const paths = (r.selectedFiles ?? []).map((f) => f.relativePath);
  assert.ok(!paths.some((p) => p.includes("node_modules")));
  // src/lib/engine.ts ya da package.json bulunmalı
  assert.ok(paths.some((p) => /engine\.ts$|package\.json$/.test(p)));
  if (orig !== undefined) process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES = orig;
  else delete process.env.VERDICT_ALLOWED_LOCAL_PATH_PREFIXES;
});

test("local-path: not_selected toggle returns clean report", async () => {
  const r = await runLocalPathSource({ selected: false, critical: false, localPath: "/tmp" });
  assert.equal(r.status, "not_selected");
  assert.equal(r.errorMessage, undefined);
});
