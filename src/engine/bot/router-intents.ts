import type { Tariff } from "../../domain/session.js";

export type RouterIntent =
  | { kind: "ignore"; reason: string }
  | { kind: "about_bureau" }
  | { kind: "start_intro" }
  | { kind: "start_new" }
  | { kind: "start_force_new" }
  | { kind: "start_continue" }
  | { kind: "recipient_name_received"; recipientName: string }
  | { kind: "generate_first" }
  | { kind: "generate_next" }
  | { kind: "go_seal" }
  | { kind: "seal_pick"; idx: number }
  | { kind: "pay"; tariff: Tariff }
  | { kind: "tz_set"; timezone: string }
  | { kind: "tz_change_requested" }
  | { kind: "delivery_manual" }
  | { kind: "delivery_username_requested" }
  | { kind: "delivery_username_received"; username: string }
  | { kind: "email_received"; email: string };

export function normalizeEmail(raw: string): string | null {
  let value = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r?\n|\r/g, "")
    .trim();

  value = value.replace(/^(e-?mail|email|почта)\s*:\s*/i, "");
  value = value.replace(/^mailto:\s*/i, "");
  value = value.replace(/^[<("'\s]+/, "").replace(/[>")'\s.,;:]+$/, "");
  value = value.toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function normalizeTelegramUsername(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "");
  const normalized = compact.startsWith("@") ? compact : `@${compact}`;
  return /^@[A-Za-z0-9_]{5,32}$/.test(normalized) ? normalized : null;
}
