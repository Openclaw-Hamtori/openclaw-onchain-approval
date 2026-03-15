import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";

import { canonicalizeJson, sanitizeJsonValue, sha256Hex } from "./canonical.js";
import { createActionDigest } from "./normalize.js";

export const RECEIPT_VERSION = "ocap/receipt@v1";

function normalizeTimestamp(value, fieldName) {
  const timestamp = value ?? new Date().toISOString();
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid ISO timestamp`);
  }

  return date.toISOString();
}

function createDefaultExpiry(issuedAt) {
  return new Date(new Date(issuedAt).getTime() + 15 * 60 * 1000).toISOString();
}

function toPrivateKeyObject(privateKeyPem) {
  return createPrivateKey(privateKeyPem);
}

function toPublicKeyPem(publicKeyInput) {
  return createPublicKey(publicKeyInput).export({ format: "pem", type: "spki" }).toString();
}

function buildKeyId(publicKeyPem) {
  return `ocapk_${sha256Hex(publicKeyPem).slice(0, 16)}`;
}

function serializeDecision(decision) {
  if (!decision || typeof decision !== "object") {
    throw new TypeError("decision must be an object");
  }

  return {
    approvalRequired: Boolean(decision.approvalRequired),
    riskLevel: typeof decision.riskLevel === "string" ? decision.riskLevel : "unknown",
    matchedRules: Array.isArray(decision.matchedRules)
      ? [...new Set(decision.matchedRules.map((item) => String(item)))]
      : [],
    reasons: Array.isArray(decision.reasons)
      ? decision.reasons.map((reason) => ({
          code: String(reason.code),
          message: String(reason.message),
        }))
      : [],
    policyContext:
      decision.policyContext && typeof decision.policyContext === "object"
        ? sanitizeJsonValue(decision.policyContext, "decision.policyContext")
        : {},
  };
}

function buildSignableReceipt({
  action,
  decision,
  publicKeyPem,
  approver = {},
  issuedAt,
  expiresAt,
  context,
}) {
  const { actionDigest, normalizedAction } = createActionDigest(action);
  const serializedDecision = serializeDecision(decision);

  if (decision.actionDigest && decision.actionDigest !== actionDigest) {
    throw new Error("decision.actionDigest does not match the provided action");
  }

  const normalizedIssuedAt = normalizeTimestamp(issuedAt, "issuedAt");
  const normalizedExpiresAt = normalizeTimestamp(
    expiresAt ?? createDefaultExpiry(normalizedIssuedAt),
    "expiresAt",
  );

  if (new Date(normalizedExpiresAt).getTime() <= new Date(normalizedIssuedAt).getTime()) {
    throw new Error("expiresAt must be later than issuedAt");
  }

  const signableReceipt = {
    version: RECEIPT_VERSION,
    action: normalizedAction,
    actionDigest,
    issuedAt: normalizedIssuedAt,
    expiresAt: normalizedExpiresAt,
    decision: serializedDecision,
    approver: {
      algorithm: "ed25519",
      keyId: approver.keyId ?? buildKeyId(publicKeyPem),
      publicKeyPem,
    },
  };

  if (typeof approver.label === "string" && approver.label.trim() !== "") {
    signableReceipt.approver.label = approver.label.trim();
  }

  if (context !== undefined) {
    signableReceipt.context = sanitizeJsonValue(context, "context");
  }

  return signableReceipt;
}

export function generateApprovalKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  return {
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

export function createApprovalReceipt({
  action,
  decision,
  privateKeyPem,
  publicKeyPem,
  approver,
  issuedAt,
  expiresAt,
  context,
}) {
  if (typeof privateKeyPem !== "string" || privateKeyPem.trim() === "") {
    throw new TypeError("privateKeyPem must be a PEM-encoded private key");
  }

  const privateKey = toPrivateKeyObject(privateKeyPem);
  const derivedPublicKeyPem = publicKeyPem ? toPublicKeyPem(publicKeyPem) : toPublicKeyPem(privateKey);
  const signableReceipt = buildSignableReceipt({
    action,
    decision,
    publicKeyPem: derivedPublicKeyPem,
    approver,
    issuedAt,
    expiresAt,
    context,
  });
  const serializedReceipt = canonicalizeJson(signableReceipt);
  const bodyDigest = sha256Hex(serializedReceipt);
  const signature = cryptoSign(null, Buffer.from(serializedReceipt), privateKey).toString("base64");

  return {
    ...signableReceipt,
    receiptId: `ocapr_${bodyDigest.slice(0, 24)}`,
    signature: {
      algorithm: "ed25519",
      bodyDigest,
      encoding: "base64",
      value: signature,
    },
  };
}

function extractSignableReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new TypeError("receipt must be an object");
  }

  return {
    version: receipt.version,
    action: receipt.action,
    actionDigest: receipt.actionDigest,
    issuedAt: receipt.issuedAt,
    expiresAt: receipt.expiresAt,
    decision: receipt.decision,
    approver: receipt.approver,
    ...(receipt.context !== undefined ? { context: receipt.context } : {}),
  };
}

export function verifyApprovalReceipt({ receipt, action, now } = {}) {
  const errors = [];
  const checks = {
    actionDigestMatchesProvidedAction: action === undefined,
    actionDigestMatchesEmbeddedAction: false,
    bodyDigestMatches: false,
    receiptIdMatches: false,
    signatureValid: false,
    notExpired: false,
  };

  try {
    const signableReceipt = extractSignableReceipt(receipt);
    const embeddedDigest = createActionDigest(signableReceipt.action).actionDigest;
    const serializedReceipt = canonicalizeJson(signableReceipt);
    const bodyDigest = sha256Hex(serializedReceipt);

    checks.actionDigestMatchesEmbeddedAction = embeddedDigest === receipt.actionDigest;
    if (!checks.actionDigestMatchesEmbeddedAction) {
      errors.push("receipt.actionDigest does not match the embedded action payload");
    }

    checks.bodyDigestMatches = receipt.signature?.bodyDigest === bodyDigest;
    if (!checks.bodyDigestMatches) {
      errors.push("receipt.signature.bodyDigest does not match the receipt body");
    }

    checks.receiptIdMatches = receipt.receiptId === `ocapr_${bodyDigest.slice(0, 24)}`;
    if (!checks.receiptIdMatches) {
      errors.push("receiptId does not match the receipt body");
    }

    if (action !== undefined) {
      checks.actionDigestMatchesProvidedAction =
        createActionDigest(action).actionDigest === receipt.actionDigest;

      if (!checks.actionDigestMatchesProvidedAction) {
        errors.push("provided action does not match receipt.actionDigest");
      }
    }

    const currentTime = new Date(normalizeTimestamp(now, "now"));
    checks.notExpired = currentTime.getTime() <= new Date(normalizeTimestamp(receipt.expiresAt, "expiresAt")).getTime();
    if (!checks.notExpired) {
      errors.push("receipt has expired");
    }

    if (receipt.approver?.algorithm !== "ed25519") {
      errors.push("unsupported approver algorithm");
    } else {
      const signatureBuffer = Buffer.from(receipt.signature?.value ?? "", "base64");
      const publicKey = createPublicKey(receipt.approver.publicKeyPem);
      checks.signatureValid = cryptoVerify(
        null,
        Buffer.from(serializedReceipt),
        publicKey,
        signatureBuffer,
      );

      if (!checks.signatureValid) {
        errors.push("receipt signature verification failed");
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    ok: errors.length === 0,
    receiptId: receipt?.receiptId ?? null,
    actionDigest: receipt?.actionDigest ?? null,
    checks,
    errors,
  };
}
