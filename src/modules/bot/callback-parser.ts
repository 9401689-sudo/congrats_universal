import type { Tariff } from "../../domain/session.js";

export type CallbackCommand =
  | { kind: "start_new" }
  | { kind: "start_force_new" }
  | { kind: "start_continue" }
  | { kind: "gen_first" }
  | { kind: "gen_next" }
  | { kind: "go_seal" }
  | { kind: "seal_pick"; idx: number }
  | { kind: "pay"; tariff: Tariff }
  | { kind: "tz"; timezone: string }
  | { kind: "tz_change" }
  | { kind: "delivery_manual" }
  | { kind: "delivery_username" }
  | { kind: "unknown"; raw: string };

export function parseCallbackData(raw: string): CallbackCommand {
  if (raw === "START_NEW") return { kind: "start_new" };
  if (raw === "START_FORCE_NEW") return { kind: "start_force_new" };
  if (raw === "START_CONTINUE") return { kind: "start_continue" };
  if (raw === "GEN_FIRST") return { kind: "gen_first" };
  if (raw === "GEN_NEXT") return { kind: "gen_next" };
  if (raw === "GO_SEAL") return { kind: "go_seal" };
  if (raw === "TZ_CHANGE") return { kind: "tz_change" };
  if (raw === "DELIV_MANUAL") return { kind: "delivery_manual" };
  if (raw === "DELIV_USERNAME") return { kind: "delivery_username" };

  if (raw.startsWith("SEAL_PICK:")) {
    const idx = Number(raw.split(":")[1] ?? 0);
    return { kind: "seal_pick", idx };
  }

  if (raw.startsWith("PAY:")) {
    const tariff = raw.split(":")[1];
    if (tariff === "149" || tariff === "199") {
      return { kind: "pay", tariff };
    }
  }

  if (raw.startsWith("TZ:")) {
    return { kind: "tz", timezone: raw.slice(3) };
  }

  return { kind: "unknown", raw };
}
