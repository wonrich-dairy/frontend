import { request, requestFile } from "../http";
import type { ProductLine } from "./panels";

// ── Types ────────────────────────────────────────────────────────────────────

export type ResultFilter = "Pass" | "Fail" | "Pending";

/** Failure reason codes (SCRUM-23). `lines` limits the codes offered for a product line. */
export const REASON_CODES: { code: string; label: string }[] = [
  { code: "LOW_FAT", label: "Low fat" },
  { code: "LOW_SNF", label: "Low SNF" },
  { code: "PH_OUT_OF_SPEC", label: "pH out of spec" },
  { code: "TASTE_OFF", label: "Taste off" },
  { code: "SMELL_OFF", label: "Smell off" },
  { code: "COLOUR_OFF", label: "Colour off" },
  { code: "APPEARANCE_OFF", label: "Appearance off" },
  { code: "TEXTURE_OFF", label: "Texture off" },
];

export const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASON_CODES.map((r) => [r.code, r.label]),
);

export type NotApplicableColumn = "snf" | "ts" | "texture";

export interface LabResultFilters {
  productLine?: ProductLine | "";
  from?: string;
  to?: string;
  result?: ResultFilter | "";
  reasonCode?: string;
}

export interface LabResultOutOfSpec {
  parameter: string;
  value: number;
  limit: string;
  limitValue: number;
}

export interface LabResultRow {
  batchCode: string;
  dispatchNumber: string;
  productLine: ProductLine;
  panelVersion: number;
  testedAtUtc: string;
  testedBy: string;
  fatPercent: number;
  ph: number;
  snf: number | null;
  ts: number | null;
  sensoryRecorded: boolean;
  taste: string | null;
  smell: string | null;
  colour: string | null;
  appearance: string | null;
  texture: string | null;
  determination: ResultFilter;
  determinationId: string | null;
  determinedAtUtc: string | null;
  determinedBy: string | null;
  reasonCodes: string[];
  outOfSpec: LabResultOutOfSpec[];
  notApplicable: NotApplicableColumn[];
}

export interface LabResultsPage {
  items: LabResultRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReasonCodeCount {
  code: string;
  count: number;
}

export interface LabResultsSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  reasonCounts: ReasonCodeCount[];
}

// ── API calls ────────────────────────────────────────────────────────────────

function toQuery(filters: LabResultFilters, page?: number): string {
  const params = new URLSearchParams();
  if (filters.productLine) params.set("productLine", filters.productLine);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.result) params.set("result", filters.result);
  if (filters.reasonCode) params.set("reasonCode", filters.reasonCode);
  if (page && page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function searchLabResults(
  filters: LabResultFilters,
  page: number,
  token: string | null,
  signal?: AbortSignal,
) {
  return request<LabResultsPage>(`/api/lab-results${toQuery(filters, page)}`, {
    token,
    signal,
    service: "qualityLab",
  });
}

export function getLabResultsSummary(filters: LabResultFilters, token: string | null, signal?: AbortSignal) {
  return request<LabResultsSummary>(`/api/lab-results/summary${toQuery(filters)}`, {
    token,
    signal,
    service: "qualityLab",
  });
}

/** Downloads every matching row (not only the current page) as CSV. */
export function exportLabResults(filters: LabResultFilters, token: string | null) {
  return requestFile(`/api/lab-results/export${toQuery(filters)}`, { token, service: "qualityLab" });
}
