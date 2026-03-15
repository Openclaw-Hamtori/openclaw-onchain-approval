import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authorizeActionExecution,
  createApprovalReceipt,
  evaluateApprovalRequirement,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readLocalFile(name) {
  return readFileSync(join(__dirname, name), "utf8");
}

const action = JSON.parse(readLocalFile("demo-action.json"));
const policy = JSON.parse(readLocalFile("demo-policy.json"));
const privateKeyPem = readLocalFile("demo-approver-private.pem");

const decision = evaluateApprovalRequirement(action, policy);

console.log("1. Policy decision");
console.log(
  JSON.stringify(
    {
      approvalRequired: decision.approvalRequired,
      riskLevel: decision.riskLevel,
      matchedRules: decision.matchedRules,
      reasons: decision.reasons,
    },
    null,
    2,
  ),
);

const receipt = createApprovalReceipt({
  action,
  decision,
  privateKeyPem,
  approver: {
    label: "Local finance approver",
  },
  issuedAt: "2026-03-15T09:00:00.000Z",
  expiresAt: "2026-03-15T09:15:00.000Z",
  context: {
    agent: "OpenClaw",
    executionMode: "dry-run",
    flow: "local-approval-kit",
  },
});

console.log("2. Approval receipt");
console.log(
  JSON.stringify(
    {
      receiptId: receipt.receiptId,
      actionDigest: receipt.actionDigest,
      approver: receipt.approver,
      expiresAt: receipt.expiresAt,
    },
    null,
    2,
  ),
);

const gateResult = authorizeActionExecution({
  action,
  policy,
  receipt,
  now: "2026-03-15T09:05:00.000Z",
});

console.log("3. Execution gate");
console.log(
  JSON.stringify(
    {
      allowed: gateResult.allowed,
      reason: gateResult.reason,
      verification: gateResult.verification,
      decisionBinding: gateResult.decisionBinding,
    },
    null,
    2,
  ),
);
