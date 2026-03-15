import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createApprovalReceipt,
  evaluateApprovalRequirement,
  verifyApprovalReceipt,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..", "examples");

function readExample(name) {
  return readFileSync(join(examplesDir, name), "utf8");
}

test("receipt verifies for the exact approved action", () => {
  const action = JSON.parse(readExample("demo-action.json"));
  const policy = JSON.parse(readExample("demo-policy.json"));
  const privateKeyPem = readExample("demo-approver-private.pem");
  const decision = evaluateApprovalRequirement(action, policy);
  const receipt = createApprovalReceipt({
    action,
    decision,
    privateKeyPem,
    approver: { label: "QA approver" },
    issuedAt: "2026-03-15T09:00:00.000Z",
    expiresAt: "2026-03-15T09:15:00.000Z",
    context: { agent: "OpenClaw", requestId: action.requestId },
  });

  const verification = verifyApprovalReceipt({
    receipt,
    action,
    now: "2026-03-15T09:05:00.000Z",
  });

  assert.equal(verification.ok, true);
  assert.deepEqual(verification.errors, []);
});

test("tampering with the action invalidates the receipt", () => {
  const action = JSON.parse(readExample("demo-action.json"));
  const policy = JSON.parse(readExample("demo-policy.json"));
  const privateKeyPem = readExample("demo-approver-private.pem");
  const decision = evaluateApprovalRequirement(action, policy);
  const receipt = createApprovalReceipt({
    action,
    decision,
    privateKeyPem,
    issuedAt: "2026-03-15T09:00:00.000Z",
    expiresAt: "2026-03-15T09:15:00.000Z",
  });

  const verification = verifyApprovalReceipt({
    receipt,
    action: {
      ...action,
      spender: "0x4444444444444444444444444444444444444444",
    },
    now: "2026-03-15T09:05:00.000Z",
  });

  assert.equal(verification.ok, false);
  assert.match(verification.errors.join(" "), /provided action does not match/);
});
