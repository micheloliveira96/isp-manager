import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, fingerprint, fresh, name, password, safeResult, safeSnapshot } from "../src/lib/mikrotik-security";
process.env.MIKROTIK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
test("senha cifrada, autenticada e sem exposição", () => {
  const cipher = encrypt({ password: "segredo-de-teste" });
  assert.ok(!cipher.includes("segredo-de-teste")); assert.equal(decrypt(cipher).password, "segredo-de-teste");
  const other = encrypt({ password: "outro" }).split("."); const parts = cipher.split("."); parts[1] = other[1];
  assert.throws(() => decrypt(parts.join(".")));
  assert.notEqual(fingerprint({ password: "a" }), fingerprint({ password: "b" }));
});
test("telemetria e resultado rejeitam segredos e comandos arbitrários", () => {
  const clean = safeSnapshot({ online: true, password: "secret", users: [{ name: "abc", password: "secret" }], sessions: [], resource: { "cpu-load": "7" } });
  assert.ok(!JSON.stringify(clean).includes("secret")); assert.equal(clean.resource?.["cpu-load"], "7");
  assert.ok(!JSON.stringify(safeResult({ ok: false, message: "secret", code: "secret with spaces" })).includes("secret"));
});
test("dados antigos não aparecem como monitoramento atual", () => {
  assert.equal(fresh(new Date(Date.now() - 100000)), false); assert.equal(fresh(null), false); assert.equal(fresh(new Date()), true);
});
test("validação de login e senha", () => {
  assert.throws(() => name("/system reboot")); assert.throws(() => password("short")); assert.equal(name("cliente-01"), "cliente-01");
});
