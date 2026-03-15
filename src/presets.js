import { createPolicy } from "./policy.js";

const PRESET_DEFINITIONS = {
  strict: {
    description:
      "Approval-heavy posture for new environments: every ERC-20 approval, swap, contract call, and low-value movement is gated.",
    policy: {
      chainId: 1,
      requireApprovalForUnknownAddress: true,
      nativeTransferThresholdWei: "2000000000000000",
      defaultErc20TransferThreshold: "250000",
      defaultAllowanceThreshold: "100000",
      alwaysRequireApprovalFor: ["swap", "contract_call", "erc20_approve"],
      knownAddresses: [],
    },
  },
  balanced: {
    description:
      "Good default for OpenClaw operators: allows routine known-counterparty transfers while gating unknown addresses, swaps, contract calls, and larger allowances.",
    policy: {
      chainId: 1,
      requireApprovalForUnknownAddress: true,
      nativeTransferThresholdWei: "10000000000000000",
      defaultErc20TransferThreshold: "1000000",
      defaultAllowanceThreshold: "250000",
      alwaysRequireApprovalFor: ["swap", "contract_call"],
      knownAddresses: [],
    },
  },
  "trusted-desk": {
    description:
      "Higher-throughput posture for an internal desk with pre-vetted counterparties, while still forcing review on unknown addresses and contract calls.",
    policy: {
      chainId: 1,
      requireApprovalForUnknownAddress: true,
      nativeTransferThresholdWei: "100000000000000000",
      defaultErc20TransferThreshold: "5000000",
      defaultAllowanceThreshold: "1000000",
      alwaysRequireApprovalFor: ["contract_call"],
      knownAddresses: [],
    },
  },
};

function clonePresetPolicy(policy) {
  return JSON.parse(JSON.stringify(policy));
}

export function listPolicyPresets() {
  return Object.entries(PRESET_DEFINITIONS).map(([name, definition]) => ({
    name,
    description: definition.description,
    policy: clonePresetPolicy(definition.policy),
  }));
}

export function getPolicyPreset(name) {
  const definition = PRESET_DEFINITIONS[name];

  if (!definition) {
    throw new Error(`Unknown policy preset: ${name}`);
  }

  return {
    name,
    description: definition.description,
    policy: clonePresetPolicy(definition.policy),
  };
}

export function createPolicyFromPreset(name, overrides = {}) {
  const preset = getPolicyPreset(name);

  return createPolicy({
    ...preset.policy,
    ...overrides,
  });
}
