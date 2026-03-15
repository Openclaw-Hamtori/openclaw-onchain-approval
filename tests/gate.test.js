import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authorizeActionExecution,
  createApprovalReceipt,
  evaluateApprovalRequirement,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..", "examples");

function readExample(name) {
  return readFileSync(join(examplesDir, name), "utf8");
}

test("execution is blocked when approval is required but no receipt is provided", () => {
  const action = JSON.parse(readExample("demo-action.json"));
  const policy = JSON.parse(readExample("demo-policy.json"));

  const result = authorizeActionExecution({
    action,
    policy,
    now: "2026-03-15T09:05:00.000Z",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "approval_required");
  assert.equal(result.decision.approvalRequired, true);
});

test("execution passes once a valid receipt is attached", () => {
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

  const result = authorizeActionExecution({
    action,
    policy,
    receipt,
    now: "2026-03-15T09:05:00.000Z",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "receipt_verified");
  assert.equal(result.verification?.ok, true);
});
