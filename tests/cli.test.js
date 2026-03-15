import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = join(__dirname, "..");
const binPath = join(projectDir, "bin", "openclaw-approval.js");

function runCli(args) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });
}

test("CLI can generate keys, issue a receipt, and authorize execution", () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), "ocap-cli-"));
  const privateKeyPath = join(workspaceDir, "approver-private.pem");
  const publicKeyPath = join(workspaceDir, "approver-public.pem");
  const receiptPath = join(workspaceDir, "receipt.json");

  const keygen = runCli([
    "keygen",
    "--private-key-out",
    privateKeyPath,
    "--public-key-out",
    publicKeyPath,
  ]);

  assert.equal(keygen.status, 0, keygen.stderr);
  assert.equal(existsSync(privateKeyPath), true);
  assert.equal(existsSync(publicKeyPath), true);

  const issue = runCli([
    "issue",
    "--action",
    "./examples/demo-action.json",
    "--policy-preset",
    "balanced",
    "--private-key",
    privateKeyPath,
    "--receipt-out",
    receiptPath,
    "--approver-label",
    "CLI QA approver",
    "--issued-at",
    "2026-03-15T09:00:00.000Z",
    "--expires-at",
    "2026-03-15T09:15:00.000Z",
  ]);

  assert.equal(issue.status, 0, issue.stderr);
  assert.equal(existsSync(receiptPath), true);

  const gate = runCli([
    "gate",
    "--action",
    "./examples/demo-action.json",
    "--policy-preset",
    "balanced",
    "--receipt",
    receiptPath,
    "--now",
    "2026-03-15T09:05:00.000Z",
  ]);

  assert.equal(gate.status, 0, gate.stderr);

  const gateResult = JSON.parse(gate.stdout);
  assert.equal(gateResult.allowed, true);
  assert.equal(gateResult.reason, "receipt_verified");
  assert.equal(gateResult.decisionBinding.ok, true);
});

test("CLI can export a preset policy file and write an evaluation artifact", () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), "ocap-cli-"));
  const policyPath = join(workspaceDir, "strict.json");
  const decisionPath = join(workspaceDir, "decision.json");

  const preset = runCli([
    "presets",
    "--name",
    "strict",
    "--output",
    policyPath,
  ]);

  assert.equal(preset.status, 0, preset.stderr);
  assert.equal(existsSync(policyPath), true);

  const evaluate = runCli([
    "evaluate",
    "--action",
    "./examples/demo-action.json",
    "--policy",
    policyPath,
    "--output",
    decisionPath,
  ]);

  assert.equal(evaluate.status, 0, evaluate.stderr);
  assert.equal(existsSync(decisionPath), true);

  const decision = JSON.parse(readFileSync(decisionPath, "utf8"));
  assert.equal(decision.approvalRequired, true);
  assert.equal(Array.isArray(decision.matchedRules), true);
  assert.match(decision.matchedRules.join(" "), /erc20_approve|unlimited_allowance/);
});
