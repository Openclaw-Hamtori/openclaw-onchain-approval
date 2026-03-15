import test from "node:test";
import assert from "node:assert/strict";

import { evaluateApprovalRequirement } from "../src/index.js";

test("erc20 unlimited approval to a new spender requires approval", () => {
  const action = {
    type: "erc20_approve",
    chainId: 1,
    from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    spender: "0x3333333333333333333333333333333333333333",
    allowance:
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
  };
  const policy = {
    chainId: 1,
    knownAddresses: ["0x1111111111111111111111111111111111111111"],
    defaultAllowanceThreshold: "1000000",
  };

  const result = evaluateApprovalRequirement(action, policy);

  assert.equal(result.approvalRequired, true);
  assert.equal(result.riskLevel, "high");
  assert.deepEqual(result.matchedRules.sort(), [
    "allowance_threshold",
    "unknown_counterparty",
    "unlimited_allowance",
  ]);
});

test("small transfer to a known address does not require approval", () => {
  const action = {
    type: "native_transfer",
    chainId: 1,
    from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    to: "0x1111111111111111111111111111111111111111",
    valueWei: "1000",
  };
  const policy = {
    chainId: 1,
    knownAddresses: ["0x1111111111111111111111111111111111111111"],
    nativeTransferThresholdWei: "10000000000000000",
  };

  const result = evaluateApprovalRequirement(action, policy);

  assert.equal(result.approvalRequired, false);
  assert.equal(result.riskLevel, "low");
  assert.deepEqual(result.reasons, []);
});
