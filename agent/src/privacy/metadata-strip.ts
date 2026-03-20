/**
 * Metadata sanitization — strips identifying metadata from requests
 * before they leave the agent. Ensures no IP, user-agent, or device
 * fingerprints leak to third-party services.
 */

export interface SanitizedRequest {
  headers: Record<string, string>;
  body: any;
  strippedFields: string[];
}

const STRIP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "user-agent",
  "referer",
  "origin",
  "cookie",
  "authorization",
  "x-request-id",
  "x-correlation-id",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
];

/**
 * Strip identifying headers from outgoing requests.
 */
export function sanitizeHeaders(
  headers: Record<string, string>
): { clean: Record<string, string>; stripped: string[] } {
  const clean: Record<string, string> = {};
  const stripped: string[] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (STRIP_HEADERS.includes(key.toLowerCase())) {
      stripped.push(key);
    } else {
      clean[key] = value;
    }
  }

  // Set a generic user-agent so the request doesn't stand out
  clean["user-agent"] = "Shade-Agent/1.0";

  return { clean, stripped };
}

/**
 * Strip identifying fields from a request body.
 */
export function sanitizeBody(
  body: Record<string, any>,
  fieldsToStrip: string[] = ["email", "name", "ip", "device", "location", "phone"]
): { clean: Record<string, any>; stripped: string[] } {
  const clean: Record<string, any> = {};
  const stripped: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (fieldsToStrip.includes(key.toLowerCase())) {
      stripped.push(key);
    } else {
      clean[key] = value;
    }
  }

  return { clean, stripped };
}
