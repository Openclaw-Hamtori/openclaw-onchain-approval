#!/usr/bin/env node

import { evaluateApprovalRequirement } from "../../src/index.js";
import {
  assertNoPositionals,
  parseArgs,
  printUsage,
  readJson,
  requireArg,
  writeJson,
} from "./shared.js";

const USAGE = [
  "Usage:",
  "  node ./examples/openclaw-hooks/preflight-evaluate.js --action <action.json> --policy <policy.json> --decision-out <decision.json>",
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
  const decisionPath = writeJson(requireArg(args, "decision-out"), decision);

  console.log(
    JSON.stringify(
      {
        approvalRequired: decision.approvalRequired,
        riskLevel: decision.riskLevel,
        matchedRules: decision.matchedRules,
        decisionPath,
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
