import { createHash } from "node:crypto";

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function sanitizeJsonValue(value, path = "value") {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must be a finite number`);
    }

    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeJsonValue(item, `${path}[${index}]`));
  }

  if (isPlainObject(value)) {
    const output = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue === undefined) {
        continue;
      }

      output[key] = sanitizeJsonValue(nestedValue, `${path}.${key}`);
    }

    return output;
  }

  throw new TypeError(`${path} must be JSON-serializable`);
}

export function canonicalizeJson(value) {
  const sanitized = sanitizeJsonValue(value);

  return canonicalizeValue(sanitized);
}

function canonicalizeValue(value) {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const serializedEntries = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key])}`,
    );

    return `{${serializedEntries.join(",")}}`;
  }

  throw new TypeError("Unsupported canonical JSON value");
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
