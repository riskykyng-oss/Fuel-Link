export const SERVICES = [
  { id: "fuel", name: "Fuel delivery", blurb: "Run out of fuel? We bring it to you.", icon: "nozzle", unit: "litre", callout_fee: 0 },
  { id: "towing", name: "Towing", blurb: "Vehicle recovery and towing.", icon: "tow", unit: "trip", callout_fee: 25 },
  { id: "jump_start", name: "Jump start", blurb: "Dead battery? We'll get you going.", icon: "battery", unit: "job", callout_fee: 8 },
  { id: "tyre_change", name: "Tyre change", blurb: "Flat tyre replacement.", icon: "tyre", unit: "job", callout_fee: 10 },
  { id: "lockout", name: "Lockout assistance", blurb: "Locked keys in the car?", icon: "key", unit: "job", callout_fee: 12 },
  { id: "mechanic", name: "Roadside mechanic", blurb: "On-site mechanical diagnosis.", icon: "wrench", unit: "job", callout_fee: 15 },
] as const;

export const SYMPTOM_MAP: Record<string, { service: string; question?: string }> = {
  out_of_fuel: { service: "fuel" },
  wont_start: { service: "mechanic", question: "Do the lights come on?" },
  flat_tyre: { service: "tyre_change", question: "Do you have a spare wheel?" },
  cant_move: { service: "towing" },
  locked_out: { service: "lockout" },
  something_else: { service: "mechanic" },
};

export const ANSWER_MAP: Record<string, string> = {
  lights_yes: "mechanic",
  lights_no: "jump_start",
  spare_yes: "tyre_change",
  spare_no: "towing",
};

export function triage(symptom: string | null, answer: string | null): string {
  if (!symptom) return "mechanic";
  const entry = SYMPTOM_MAP[symptom];
  if (!entry) return "mechanic";
  if (entry.question && answer) return ANSWER_MAP[answer] ?? "mechanic";
  return entry.service;
}

export const PAYMENT_METHODS = [
  { id: "ecocash", name: "EcoCash", kind: "mobile_money", requires_phone: true, prefixes: ["077", "078"], note: "You will get a PIN prompt on your handset.", live: false },
  { id: "onemoney", name: "OneMoney", kind: "mobile_money", requires_phone: true, prefixes: ["071"], note: "You will get a PIN prompt on your handset.", live: false },
  { id: "innbucks", name: "InnBucks", kind: "mobile_money", requires_phone: true, prefixes: ["078", "077", "071"], note: "Approve the collection in your InnBucks app.", live: false },
  { id: "zipit", name: "Card / ZIPIT", kind: "redirect", requires_phone: false, prefixes: [], note: "Opens the secure Paynow checkout page.", live: false },
];
