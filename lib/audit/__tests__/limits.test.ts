import { test } from "node:test";
import { strict as assert } from "node:assert";

test("limits: default values lift old hard caps", async () => {
  // Re-import after env changes — flat module
  const { AUDIT_LIMITS } = await import("../limits");
  // Eski 80_000 → yeni default 200_000
  assert.ok(AUDIT_LIMITS.contextPackChars >= 200_000);
  // Eski 25 dosya sınırı → yeni default >= 80
  assert.ok(AUDIT_LIMITS.githubFilesToRead >= 80);
  // Hard ceiling >= 300_000
  assert.ok(AUDIT_LIMITS.contextPackHardCeiling >= 300_000);
});
