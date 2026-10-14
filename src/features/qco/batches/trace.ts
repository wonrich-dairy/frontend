import { REASON_CODES } from "../../../api/qualityLab/determinations";
import type {
  BatchCheckpoint,
  BatchLinksDto,
  BatchRecordDto,
  BatchStatus,
  CheckpointRecordDto,
  CheckpointSectionDto,
  DeviationDto,
  TankLinkDto,
} from "../../../api/traceability/batches";
import { parseUtc } from "../../../utils/time";
import { normalizeSnf } from "../../../utils/labels";

// Everything the timeline and backward-trace screens work out from a batch record, kept free of
// React so the rules for missing data are unit-tested on their own.

export const CHECKPOINT_LABELS: Record<BatchCheckpoint, string> = {
  Mcc: "MCC",
  Intake: "Factory intake",
  Processing: "Processing",
  Lab: "Quality lab",
};

export const STATUS_LABELS: Record<BatchStatus, string> = {
  Chilling: "Chilling",
  Processing: "In processing",
  OnHold: "On hold",
  AwaitingLab: "Awaiting lab",
  Cleared: "Cleared",
  Failed: "Failed",
};

// The shared badge tones, so a status reads the same here as in every other module.
export const STATUS_TONES: Record<BatchStatus, string> = {
  Chilling: "badge--pending",
  Processing: "badge--pending",
  OnHold: "badge--warn",
  AwaitingLab: "badge--pending",
  Cleared: "badge--good",
  Failed: "badge--bad",
};

function time(value: string): number {
  return parseUtc(value).getTime();
}

// "MilkAllocatedToMixingTank" -> "Milk allocated to mixing tank", "TemperatureC" ->
// "Temperature C". Acronyms and units (all capitals) keep their case.
export function humanise(name: string): string {
  const words = name
    .replace(/Event$/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lowered = /^[A-Z][a-z0-9]+$/.test(word) ? word.toLowerCase() : word;
      return index === 0 ? lowered.charAt(0).toUpperCase() + lowered.slice(1) : lowered;
    });

  return normalizeSnf(words.join(" ").replace(/\b(?:PH|Ph)\b/g, "pH"));
}

// ── Missing data ─────────────────────────────────────────────────────────────

// Why a checkpoint has no data, or null when it has some. A blank checkpoint must never read as
// "nothing happened there", so every state without data has a sentence.
export function missingReason(section: CheckpointSectionDto, batch: BatchRecordDto): string | null {
  if (section.state === "Recorded") {
    return null;
  }

  if (section.state === "NotYetReached") {
    return `Not reached yet: the batch is ${STATUS_LABELS[batch.status].toLowerCase()}.`;
  }

  if (section.checkpoint === "Mcc" || section.checkpoint === "Intake") {
    return `No data received. ${upstreamReason(batch)}`;
  }

  return section.checkpoint === "Processing"
    ? "No data received. No Processing event has arrived, although the batch is past this point."
    : "No data received. No Quality Lab event has arrived, although the batch is past this point.";
}

// The MCC and Intake records, and the links to tanks and societies, all come from one upstream
// lookup, so they share its reason for being missing.
export function upstreamReason(batch: BatchRecordDto): string {
  const upstream = batch.upstream;

  if (upstream === null) {
    return "The lookup of the MCC and Intake records has not run yet.";
  }

  const because = upstream.failureReason ? ` Last error: ${upstream.failureReason}` : "";

  if (upstream.status === "PendingRetry") {
    const attempts = upstream.attemptCount === 1 ? "1 attempt" : `${upstream.attemptCount} attempts`;
    return `The MCC and Intake lookup has not resolved yet (${attempts}); it will be retried.${because}`;
  }

  if (upstream.status === "Unavailable") {
    return `The MCC and Intake Service could not supply the records.${because}`;
  }

  return "The MCC and Intake Service returned nothing for this checkpoint.";
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export type TimelineItem =
  | { type: "record"; at: string; record: CheckpointRecordDto; deviations: DeviationDto[] }
  | { type: "deviation"; at: string; deviation: DeviationDto };

// One checkpoint's records in the order they happened, each with the deviations it reported. A
// deviation is copied from its event with the same time, so it is matched on that. One that
// matches no record (the MCC and Intake records come from the upstream lookup, not from events)
// is listed on its own rather than dropped.
export function timelineItems(section: CheckpointSectionDto): TimelineItem[] {
  const unmatched = [...section.deviations];

  const records: TimelineItem[] = section.records.map((record) => {
    const at = time(record.occurredAt);
    const deviations = unmatched.filter((deviation) => time(deviation.occurredAt) === at);

    for (const deviation of deviations) {
      unmatched.splice(unmatched.indexOf(deviation), 1);
    }

    return { type: "record", at: record.occurredAt, record, deviations };
  });

  const loose: TimelineItem[] = unmatched.map((deviation) => ({
    type: "deviation",
    at: deviation.occurredAt,
    deviation,
  }));

  // A stable sort, so records sharing a time keep the order the service gave them.
  return [...records, ...loose].sort((a, b) => time(a.at) - time(b.at));
}

export function deviationCount(batch: BatchRecordDto): number {
  return batch.checkpoints.reduce((total, section) => total + section.deviations.length, 0);
}

// "Temperature C 12.40 against a limit of 4.00", or whatever part of that the deviation carries.
// The reading and its limit share a precision, so they can be compared at a glance.
export function describeDeviation(deviation: DeviationDto): string {
  const what = deviation.parameter ? humanise(deviation.parameter) : null;
  const values = [deviation.observedValue, deviation.limit].filter((value): value is number => value !== null);
  const digits = values.every(Number.isInteger) ? 0 : 2;
  const number = (value: number) => value.toFixed(digits);
  const reading =
    deviation.observedValue !== null
      ? deviation.limit !== null
        ? `${number(deviation.observedValue)} against a limit of ${number(deviation.limit)}`
        : number(deviation.observedValue)
      : null;
  const measured = [what, reading].filter(Boolean).join(" ");

  return measured || deviation.description || "Flagged as a deviation; no reading was given.";
}

const REASON_LABELS: Record<string, string> = Object.fromEntries(REASON_CODES.map((r) => [r.code, r.label]));

// The lab's own label for its reason codes, as the dashboard shows them; other checkpoints' codes
// such as TemperatureHigh are spelt out.
export function deviationTitle(deviation: DeviationDto): string {
  if (!deviation.reasonCode) {
    return "Deviation";
  }

  return REASON_LABELS[deviation.reasonCode] ?? humanise(deviation.reasonCode);
}

// The record's own fields worth reading on a phone: plain values, and one level into an object
// such as the society. Anything deeper is left to the raw record.
export function recordFacts(data: Record<string, unknown> | null): [string, string][] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const facts: [string, string][] = [];

  for (const [key, value] of Object.entries(data)) {
    if (isPlain(value)) {
      facts.push([humanise(key), String(value)]);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (isPlain(innerValue)) {
          facts.push([`${humanise(key)} ${humanise(inner).toLowerCase()}`, String(innerValue)]);
        }
      }
    }
  }

  return facts;
}

function isPlain(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

// ── Contributors ─────────────────────────────────────────────────────────────

export interface RankedTank {
  tank: TankLinkDto;
  // A fraction of the litres drawn across every tank, 0 to 1.
  share: number;
}

// Tanks by the litres drawn into the dispatch, most first.
export function rankTanks(links: BatchLinksDto): RankedTank[] {
  const total = links.tanks.reduce((sum, tank) => sum + tank.quantityDrawnLitres, 0);

  return [...links.tanks]
    .sort((a, b) => b.quantityDrawnLitres - a.quantityDrawnLitres || a.code.localeCompare(b.code))
    .map((tank) => ({ tank, share: total > 0 ? tank.quantityDrawnLitres / total : 0 }));
}

export interface RankedSociety {
  code: string;
  name: string | null;
  litres: number;
  share: number;
  consignments: string[];
  tanks: string[];
}

// Societies by the litres their consignments put into the drawn tanks, most first. A society
// that delivered to two tanks is counted once, with both.
export function rankSocieties(links: BatchLinksDto): RankedSociety[] {
  const byCode = new Map<string, RankedSociety>();

  for (const tank of links.tanks) {
    for (const consignment of tank.consignments) {
      const { code, name } = consignment.society;
      const society = byCode.get(code) ?? { code, name, litres: 0, share: 0, consignments: [], tanks: [] };

      society.litres += consignment.volumeLitres;
      society.name ??= name;
      society.consignments.push(consignment.reference);

      if (!society.tanks.includes(tank.code)) {
        society.tanks.push(tank.code);
      }

      byCode.set(code, society);
    }
  }

  const societies = [...byCode.values()];
  const total = societies.reduce((sum, society) => sum + society.litres, 0);

  return societies
    .map((society) => ({ ...society, share: total > 0 ? society.litres / total : 0 }))
    .sort((a, b) => b.litres - a.litres || a.code.localeCompare(b.code));
}
