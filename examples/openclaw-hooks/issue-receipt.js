#!/usr/bin/env node

import {
  createApprovalReceipt,
  evaluateApprovalRequirement,
} from "../../src/index.js";
import {
  assertNoPositionals,
  parseArgs,
  printUsage,
  readJson,
  readText,
  requireArg,
  writeJson,
} from "./shared.js";

const USAGE = [
  "Usage:",
  "  node ./examples/openclaw-hooks/issue-receipt.js --action <action.json> --policy <policy.json> --private-key <private.pem> --receipt-out <receipt.json> [--context <context.json>] [--approver-label <label>] [--issued-at <iso-time>] [--expires-at <iso-time>]",
];

try {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage(USAGE);
    process.exit(0);
  }

  assertNoPositionals(args);

  const action = readJson(requireArg(args, "action"));
  const policy = readJson(requireArg(args, "policy"));
  const decision = evaluateApprovalRequirement(action, policy);

  if (!decision.approvalRequired) {
    console.log(
      JSON.stringify(
        {
          created: false,
          reason: "approval_not_required",
          decision,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const receipt = createApprovalReceipt({
    action,
    decision,
    privateKeyPem: readText(requireArg(args, "private-key")),
    approver: {
      label:
        typeof args["approver-label"] === "string"
          ? args["approver-label"]
          : "OpenClaw local approver",
    },
    issuedAt: typeof args["issued-at"] === "string" ? args["issued-at"] : undefined,
    expiresAt: typeof args["expires-at"] === "string" ? args["expires-at"] : undefined,
    context: args.context ? readJson(args.context) : undefined,
  });
  const receiptPath = writeJson(requireArg(args, "receipt-out"), receipt);

  console.log(
    JSON.stringify(
      {
        created: true,
        receiptId: receipt.receiptId,
        actionDigest: receipt.actionDigest,
        expiresAt: receipt.expiresAt,
        matchedRules: decision.matchedRules,
        receiptPath,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  printUsage(USAGE);
  process.exit(1);
}
