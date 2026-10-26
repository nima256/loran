/**
 * MeliPayamak shared-template API response interpreter.
 * This module deliberately has no framework dependencies, so it can be
 * regression-tested without a database, credentials, or an actual SMS send.
 *
 * IMPORTANT: MeliPayamak can return HTTP 200 for an application-level error.
 * A successful transport response is NOT proof that a message was queued.
 */

export interface SmsProviderResult {
  accepted: boolean;
  /** What failed: transport, explicit rejection, or unconfirmed response. */
  outcome: "accepted" | "rejected" | "unconfirmed";
  /** Safe metadata for structured production logs. No raw provider body. */
  diagnostic: {
    httpStatus: number;
    responseFormat: "json" | "empty" | "non_json";
    recIdPresent: boolean;
    providerStatus?: string;
    providerCode?: string;
    providerMessage?: string;
    responseFields?: string[];
  };
}

type Data = Record<string, unknown>;

function object(value: unknown): Data | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Data) : null;
}

function shortText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim().slice(0, 400);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

/** Sanitize dynamic diagnostics: status text could reflect phone, OTP, or key. */
export function safeSmsDiagnosticText(value: unknown, secrets: string[]): string | undefined {
  const source = shortText(value);
  if (!source) return undefined;
  let safe = source;
  for (const candidate of secrets) {
    if (candidate && candidate.length >= 3) {
      safe = safe.split(candidate).join("[redacted]");
    }
  }
  safe = safe
    .replace(/(?:\+?98|0)9\d{9}/g, "[phone]")
    .replace(/[\d۰-۹٠-٩]{4,}/g, "[number]")
    .replace(/[\r\n\t\u0000-\u001f]+/g, " ");
  return safe.slice(0, 160);
}

/**
 * Interpret provider output without inferring success from HTTP 200 alone.
 * The documented shared API returns {recId, status}; recId > 0 indicates
 * the provider queued the SMS. A nonempty status without recId is typically
 * the rejection reason. All other 2xx shapes are *unconfirmed*.
 */
export function interpretSmsResponse(
  httpStatus: number,
  responseText: string,
  secrets: string[] = []
): SmsProviderResult {
  let parsed: unknown;
  let responseFormat: "json" | "empty" | "non_json" = "empty";
  if (responseText.trim()) {
    try {
      parsed = JSON.parse(responseText);
      responseFormat = "json";
    } catch {
      responseFormat = "non_json";
    }
  }

  const root = object(parsed);
  const nested = object(root?.data);
  const data = nested ?? root;
  const recId = data?.recId ?? data?.recID ?? root?.recId;
  const recIdPresent =
    (typeof recId === "number" && Number.isSafeInteger(recId) && recId > 0) ||
    (typeof recId === "string" && /^\d+$/.test(recId.trim()) && BigInt(recId.trim()) > 0n);

  const providerStatus = data?.status ?? root?.status;
  const providerCode = root?.RetStatus ?? root?.code ?? root?.errorCode ?? root?.statusCode;
  const rawProviderMessage =
    (typeof providerStatus === "string" && providerStatus.trim() && !/^(?:ok|success|successful|accepted)$/i.test(providerStatus.trim())
      ? providerStatus
      : undefined) ??
    root?.StrRetStatus ??
    root?.message ??
    root?.error ??
    data?.message ??
    (object(root?.errors)?.message) ??
    (typeof root?.Value === "string" && root.Value.startsWith("-") ? root.Value : undefined);

  // Only whitelist expected response field names; never log raw response objects.
  const permitted = ["recId", "recID", "status", "code", "errorCode", "message", "error", "RetStatus", "StrRetStatus", "Value", "data", "errors"];
  const responseFields = root ? permitted.filter((key) => Object.hasOwn(root, key)) : undefined;

  const diagnostic = {
    httpStatus,
    responseFormat,
    recIdPresent,
    ...(shortText(providerStatus) !== undefined ? { providerStatus: safeSmsDiagnosticText(providerStatus, secrets) } : {}),
    ...(shortText(providerCode) !== undefined ? { providerCode: safeSmsDiagnosticText(providerCode, secrets) } : {}),
    ...(rawProviderMessage !== undefined ? { providerMessage: safeSmsDiagnosticText(rawProviderMessage, secrets) } : {}),
    ...(responseFields ? { responseFields } : {}),
  };

  if (httpStatus < 200 || httpStatus >= 300) {
    return { accepted: false, outcome: "rejected", diagnostic };
  }

  // The shared-line endpoint documents recId as the acknowledgement.
  // With a valid ID, treat even an optional informational status as accepted.
  if (recIdPresent) {
    return { accepted: true, outcome: "accepted", diagnostic };
  }

  const hasRejection = Boolean(rawProviderMessage) ||
    (typeof providerStatus === "number" && providerStatus < 0) ||
    (typeof root?.success === "boolean" && !root.success);

  return { accepted: false, outcome: hasRejection ? "rejected" : "unconfirmed", diagnostic };
}
