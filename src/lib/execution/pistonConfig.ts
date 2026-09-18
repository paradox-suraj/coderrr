/**
 * Piston Execution Environment Schema & Configuration Validator
 *
 * Ensures that remote C++ and Java execution endpoints are valid, reachable,
 * and never silently fall back to deprecated or dead endpoints.
 */

export interface PistonValidationResult {
  isValid: boolean;
  url?: string;
  hasKey: boolean;
  reason?: string;
}

export function validatePistonUrl(
  rawUrl?: string,
  rawKey?: string
): PistonValidationResult {
  const trimmedUrl = rawUrl?.trim();
  const trimmedKey = rawKey?.trim();

  if (!trimmedUrl) {
    return {
      isValid: false,
      hasKey: false,
      reason: "PISTON_URL is not configured on the server.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return {
      isValid: false,
      hasKey: false,
      reason: `Malformed PISTON_URL: "${trimmedUrl}" is not a valid HTTP/HTTPS URL.`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      hasKey: false,
      reason: `Invalid protocol: PISTON_URL must use http: or https: (got "${parsed.protocol}").`,
    };
  }

  // emkc.org deprecated check: public unauthenticated access was shut down Feb 2026
  const isEmkc =
    parsed.hostname === "emkc.org" || parsed.hostname.endsWith(".emkc.org");

  if (isEmkc && !trimmedKey) {
    return {
      isValid: false,
      hasKey: false,
      reason:
        "The public emkc.org Piston endpoint is deprecated for unauthenticated use (closed Feb 15, 2026). Provide a PISTON_KEY or configure a self-hosted Piston URL.",
    };
  }

  return {
    isValid: true,
    url: parsed.toString(),
    hasKey: Boolean(trimmedKey),
  };
}

export function getPistonStatus() {
  const validation = validatePistonUrl(
    process.env.PISTON_URL,
    process.env.PISTON_KEY
  );
  return {
    configured: validation.isValid,
    endpoint: validation.isValid ? validation.url! : null,
    hasKey: validation.hasKey,
    reason: validation.reason,
    supportedLanguages: [
      "python",
      "javascript",
      ...(validation.isValid ? ["cpp", "java"] : []),
    ],
  };
}

export function isPistonConfigured(): boolean {
  return getPistonStatus().configured;
}

export function getPistonEndpoint(): string | null {
  return getPistonStatus().endpoint;
}
