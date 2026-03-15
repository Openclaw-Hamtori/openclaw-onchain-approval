import { canonicalizeJson, sanitizeJsonValue, sha256Hex } from "./canonical.js";

export const ACTION_VERSION = "ocap/action@v1";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SELECTOR_PATTERN = /^0x[a-fA-F0-9]{8}$/;
const HEX_DATA_PATTERN = /^0x(?:[a-fA-F0-9]{2})*$/;
const DECIMAL_PATTERN = /^(0|[1-9]\d*)$/;
const SUPPORTED_ACTION_TYPES = new Set([
  "native_transfer",
  "erc20_transfer",
  "erc20_approve",
  "swap",
  "contract_call",
]);

function expectObject(value, fieldName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an object`);
  }
}

function normalizeNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeAddress(value, fieldName) {
  const normalized = normalizeNonEmptyString(value, fieldName);

  if (!ADDRESS_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a 20-byte hex address`);
  }

  return normalized.toLowerCase();
}

function normalizeChainId(value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError("chainId must be a positive integer");
  }

  return value;
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

  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a base-10 unsigned integer string`);
  }

  return BigInt(value).toString();
}

function normalizeOptionalString(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  return normalizeNonEmptyString(value, fieldName);
}

function normalizeHexData(value, fieldName, fallback = "0x") {
  if (value === undefined) {
    return fallback;
  }

  const normalized = normalizeNonEmptyString(value, fieldName);

  if (!HEX_DATA_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be hex data`);
  }

  return normalized.toLowerCase();
}

function normalizeSelector(value, fieldName) {
  const normalized = normalizeNonEmptyString(value, fieldName);

  if (!SELECTOR_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a 4-byte hex selector`);
  }

  return normalized.toLowerCase();
}

function appendCommonFields(normalizedAction, input) {
  const requestId = normalizeOptionalString(input.requestId, "requestId");
  const memo = normalizeOptionalString(input.memo, "memo");

  if (requestId !== undefined) {
    normalizedAction.requestId = requestId;
  }

  if (memo !== undefined) {
    normalizedAction.memo = memo;
  }

  if (input.metadata !== undefined) {
    normalizedAction.metadata = sanitizeJsonValue(input.metadata, "metadata");
  }

  return normalizedAction;
}

export function normalizeAction(action) {
  expectObject(action, "action");

  const type = normalizeNonEmptyString(action.type, "type");

  if (!SUPPORTED_ACTION_TYPES.has(type)) {
    throw new TypeError(`Unsupported action type: ${type}`);
  }

  const base = {
    version: ACTION_VERSION,
    type,
    chainId: normalizeChainId(action.chainId),
    from: normalizeAddress(action.from, "from"),
  };

  switch (type) {
    case "native_transfer":
      return appendCommonFields(
        {
          ...base,
          to: normalizeAddress(action.to, "to"),
          counterparty: normalizeAddress(action.to, "to"),
          valueWei: normalizeUintString(action.valueWei, "valueWei"),
        },
        action,
      );
    case "erc20_transfer":
      return appendCommonFields(
        {
          ...base,
          token: normalizeAddress(action.token, "token"),
          to: normalizeAddress(action.to, "to"),
          counterparty: normalizeAddress(action.to, "to"),
          amount: normalizeUintString(action.amount, "amount"),
        },
        action,
      );
    case "erc20_approve":
      return appendCommonFields(
        {
          ...base,
          token: normalizeAddress(action.token, "token"),
          spender: normalizeAddress(action.spender, "spender"),
          counterparty: normalizeAddress(action.spender, "spender"),
          allowance: normalizeUintString(action.allowance, "allowance"),
        },
        action,
      );
    case "swap":
      return appendCommonFields(
        {
          ...base,
          router: normalizeAddress(action.router, "router"),
          counterparty: normalizeAddress(action.router, "router"),
          tokenIn: normalizeAddress(action.tokenIn, "tokenIn"),
          tokenOut: normalizeAddress(action.tokenOut, "tokenOut"),
          amountIn: normalizeUintString(action.amountIn, "amountIn"),
          minAmountOut: normalizeUintString(action.minAmountOut, "minAmountOut"),
          recipient: normalizeAddress(action.recipient ?? action.from, "recipient"),
        },
        action,
      );
    case "contract_call":
      return appendCommonFields(
        {
          ...base,
          to: normalizeAddress(action.to, "to"),
          counterparty: normalizeAddress(action.to, "to"),
          functionSelector: normalizeSelector(action.functionSelector, "functionSelector"),
          data: normalizeHexData(action.data, "data"),
          valueWei: normalizeUintString(action.valueWei ?? "0", "valueWei"),
        },
        action,
      );
    default:
      throw new TypeError(`Unsupported action type: ${type}`);
  }
}

export function getActionCounterparty(action) {
  return normalizeAction(action).counterparty;
}

export function createActionDigest(action) {
  const normalizedAction = normalizeAction(action);
  const actionDigest = sha256Hex(canonicalizeJson(normalizedAction));

  return {
    actionDigest,
    normalizedAction,
  };
}
