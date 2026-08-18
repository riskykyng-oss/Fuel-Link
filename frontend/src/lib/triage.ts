import type { IconName } from "../components/brand";
import type { ServiceType, SymptomType } from "./api";

/**
 * Mirror of the server's triage table (backend/app/services/triage.py).
 * The client keeps it so the follow-up question can be shown without a round
 * trip; the server is the source of truth for the mapping at request time.
 */

export const SYMPTOMS: {
  id: SymptomType;
  label: string;
  blurb: string;
  icon: IconName;
  tint?: "fuel" | "electrical" | "tyre" | "recovery";
  hero?: boolean;
  wide?: boolean;
}[] = [
  {
    id: "out_of_fuel",
    label: "Out of fuel",
    blurb: "Empty tank, gauge on E",
    icon: "nozzle",
    tint: "fuel",
    hero: true,
  },
  { id: "wont_start", label: "Won't start", blurb: "No response, no crank", icon: "battery", tint: "electrical" },
  { id: "flat_tyre", label: "Flat tyre", blurb: "Tyre deflated, can't drive", icon: "tyre", tint: "tyre" },
  { id: "cant_move", label: "Car won't move", blurb: "Stuck in place, won't drive", icon: "tow", tint: "recovery" },
  { id: "locked_out", label: "Locked out", blurb: "Keys stuck inside", icon: "key" },
  { id: "something_else", label: "Something else", blurb: "Tell us what's wrong", icon: "dots", wide: true },
];

const BRANCHES: Partial<Record<SymptomType, string>> = {
  wont_start: "Do the lights come on?",
  flat_tyre: "Do you have a spare wheel?",
};

const ANSWER_TO_SERVICE: Record<string, ServiceType> = {
  lights_yes: "mechanic",
  lights_no: "jump_start",
  spare_yes: "tyre_change",
  spare_no: "towing",
};

const DIRECT: Partial<Record<SymptomType, ServiceType>> = {
  out_of_fuel: "fuel",
  cant_move: "towing",
  locked_out: "lockout",
  something_else: "mechanic",
};

export function followUpQuestion(symptom: SymptomType | null): string | null {
  return symptom ? (BRANCHES[symptom] ?? null) : null;
}

export function resolveService(
  symptom: SymptomType | null,
  answer: string | null,
): ServiceType {
  if (symptom && DIRECT[symptom]) return DIRECT[symptom];
  if (symptom && BRANCHES[symptom]) return ANSWER_TO_SERVICE[answer ?? ""] ?? "mechanic";
  return "mechanic";
}

export type TriageStep = {
  symptom: SymptomType | null;
  answer: string | null;
  service: ServiceType;
};
