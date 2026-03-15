import test from "node:test";
import assert from "node:assert/strict";

import { createPolicyFromPreset, getPolicyPreset, listPolicyPresets } from "../src/index.js";

test("policy presets are discoverable and stable", () => {
  const names = listPolicyPresets().map((preset) => preset.name).sort();

  assert.deepEqual(names, ["balanced", "strict", "trusted-desk"]);
});

test("creating a policy from a preset preserves the preset defaults", () => {
  const preset = getPolicyPreset("balanced");
  const policy = createPolicyFromPreset("balanced");

  assert.equal(preset.policy.defaultAllowanceThreshold, "250000");
  assert.equal(policy.defaultAllowanceThreshold, "250000");
  assert.equal(policy.alwaysRequireApprovalFor.has("swap"), true);
  assert.equal(policy.requireApprovalForUnknownAddress, true);
});
