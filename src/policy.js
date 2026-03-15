import { createActionDigest } from "./normalize.js";

export const POLICY_VERSION = "ocap/policy@v1";
export const POLICY_DECISION_VERSION = "ocap/policy-decision@v1";
export const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const DEFAULT_CHAIN_ID = 1;
const CRITICAL_REASON_CODES = new Set([
  "always_require_type",
  "chain_mismatch",
  "unlimited_allowance",
]);

function normalizeAddress(value, fieldName) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new TypeError(`${fieldName} must be a 20-byte hex address`);
  }

  return value.toLowerCase();
}

function normalizeAddressList(value, fieldName) {
  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return [...new Set(value.map((address, index) => normalizeAddress(address, `${fieldName}[${index}]`)))].sort();
  }

  if (value && typeof value === "object") {
    return [...new Set(Object.values(value).map((address) => normalizeAddress(address, fieldName)))].sort();
  }

  throw new TypeError(`${fieldName} must be an array or object`);
}

function normalizeUintString(value, fieldName) {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new TypeError(`${fieldName} must be an unsigned integer`);
    }

    return value.toString();
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`${fieldName} must be a safe unsigned integer`);
    }

    return String(value);
  }

  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new TypeError(`${fieldName} must be a base-10 unsigned integer string`);
  }

  return BigInt(value).toString();
}

function normalizeThresholdMap(value, fieldName) {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an object`);
  }

  const output = {};

  for (const [address, threshold] of Object.entries(value)) {
    output[normalizeAddress(address, `${fieldName}.${address}`)] = normalizeUintString(
      threshold,
      `${fieldName}.${address}`,
    );
  }

  return output;
}

function normalizeActionTypes(value, fieldName) {
  if (value === undefined) {
    return ["swap", "contract_call"];
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an array`);
  }

  return [...new Set(value.map((item) => String(item)))];
}

function toBigInt(value) {
  return BigInt(value);
}

function summarizePolicy(policy) {
  return {
    chainId: policy.chainId,
    requireApprovalForUnknownAddress: policy.requireApprovalForUnknownAddress,
    nativeTransferThresholdWei: policy.nativeTransferThresholdWei,
    defaultErc20TransferThreshold: policy.defaultErc20TransferThreshold,
    defaultAllowanceThreshold: policy.defaultAllowanceThreshold,
    alwaysRequireApprovalFor: [...policy.alwaysRequireApprovalFor].sort(),
    knownAddressCount: policy.knownAddressList.length,
  };
}

export function createPolicy(input = {}) {
  if (input && input.version === POLICY_VERSION && input.knownAddresses instanceof Set) {
    return input;
  }

  const chainId = input.chainId ?? DEFAULT_CHAIN_ID;

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new TypeError("policy.chainId must be a positive integer");
  }

  const knownAddressList = normalizeAddressList(input.knownAddresses, "knownAddresses");

  return {
    version: POLICY_VERSION,
    chainId,
    knownAddressList,
    knownAddresses: new Set(knownAddressList),
    requireApprovalForUnknownAddress: input.requireApprovalForUnknownAddress ?? true,
    nativeTransferThresholdWei: normalizeUintString(
      input.nativeTransferThresholdWei ?? "10000000000000000",
      "nativeTransferThresholdWei",
    ),
    defaultErc20TransferThreshold: normalizeUintString(
      input.defaultErc20TransferThreshold ?? "1000000",
      "defaultErc20TransferThreshold",
    ),
    defaultAllowanceThreshold: normalizeUintString(
      input.defaultAllowanceThreshold ?? "1000000",
      "defaultAllowanceThreshold",
    ),
    erc20TransferThresholds: normalizeThresholdMap(
      input.erc20TransferThresholds,
      "erc20TransferThresholds",
    ),
    allowanceThresholds: normalizeThresholdMap(input.allowanceThresholds, "allowanceThresholds"),
    alwaysRequireApprovalFor: new Set(
      normalizeActionTypes(input.alwaysRequireApprovalFor, "alwaysRequireApprovalFor"),
    ),
  };
}

function addReason(reasons, code, message) {
  reasons.push({ code, message });
}

function getRiskLevel(reasons) {
  if (reasons.length === 0) {
    return "low";
  }

  if (reasons.some((reason) => CRITICAL_REASON_CODES.has(reason.code))) {
    return "high";
  }

  return "medium";
}

export function evaluateApprovalRequirement(action, policyInput = {}) {
  const policy = createPolicy(policyInput);
  const { actionDigest, normalizedAction } = createActionDigest(action);
  const reasons = [];

  if (normalizedAction.chainId !== policy.chainId) {
    addReason(
      reasons,
      "chain_mismatch",
      `Action targets chain ${normalizedAction.chainId}, but this MVP policy only supports chain ${policy.chainId}`,
    );
  }

  if (policy.alwaysRequireApprovalFor.has(normalizedAction.type)) {
    addReason(
      reasons,
      "always_require_type",
      `${normalizedAction.type} actions always require explicit approval in the MVP`,
    );
  }

  if (
    policy.requireApprovalForUnknownAddress &&
    normalizedAction.counterparty &&
    !policy.knownAddresses.has(normalizedAction.counterparty)
  ) {
    addReason(
      reasons,
      "unknown_counterparty",
      `Counterparty ${normalizedAction.counterparty} is not in the local allowlist`,
    );
  }

  if (
    normalizedAction.type === "native_transfer" &&
    toBigInt(normalizedAction.valueWei) > toBigInt(policy.nativeTransferThresholdWei)
  ) {
    addReason(
      reasons,
      "native_transfer_threshold",
      `Native transfer exceeds the ${policy.nativeTransferThresholdWei} wei approval threshold`,
    );
  }

  if (normalizedAction.type === "erc20_transfer") {
    const threshold =
      policy.erc20TransferThresholds[normalizedAction.token] ??
      policy.defaultErc20TransferThreshold;

    if (toBigInt(normalizedAction.amount) > toBigInt(threshold)) {
      addReason(
        reasons,
        "erc20_transfer_threshold",
        `ERC-20 transfer exceeds the ${threshold} unit approval threshold for ${normalizedAction.token}`,
      );
    }
  }

  if (normalizedAction.type === "erc20_approve") {
    const threshold =
      policy.allowanceThresholds[normalizedAction.token] ?? policy.defaultAllowanceThreshold;

    if (normalizedAction.allowance === MAX_UINT256) {
      addReason(
        reasons,
        "unlimited_allowance",
        "Unlimited token allowance always requires approval",
      );
    }

    if (toBigInt(normalizedAction.allowance) > toBigInt(threshold)) {
      addReason(
        reasons,
        "allowance_threshold",
        `Token allowance exceeds the ${threshold} unit approval threshold for ${normalizedAction.token}`,
      );
    }
  }

  if (
    normalizedAction.type === "contract_call" &&
    toBigInt(normalizedAction.valueWei) > 0n
  ) {
    addReason(
      reasons,
      "contract_call_value",
      "Contract calls with attached native value require review",
    );
  }

  return {
    version: POLICY_DECISION_VERSION,
    approvalRequired: reasons.length > 0,
    riskLevel: getRiskLevel(reasons),
    actionDigest,
    normalizedAction,
    matchedRules: reasons.map((reason) => reason.code),
    reasons,
    policyContext: summarizePolicy(policy),
  };
}
