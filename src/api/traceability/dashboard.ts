import { request } from "../http";

// Read-only by design: the QCO has no write action anywhere in the module (SCRUM-136),
// so this file exports GET calls only.

// ── Types ────────────────────────────────────────────────────────────────────

export const PRODUCT_LINES = ["FM", "FLM", "SY", "SK", "DY", "CD"] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];

// As the service names them; the screen gives MCC its capitals.
export const CHECKPOINTS = ["Mcc", "Intake", "Processing", "Lab"] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

export interface DashboardFilters {
  facility?: string;
  productLine?: ProductLine;
  from?: string;
  to?: string;
}

// Every response carries the time of the last event projected (UTC), so the screen can show
// how fresh the figures are. Null until the service has processed an event.
interface Freshness {
  dataAsOf: string | null;
}

export interface StatusCounts {
  pending: number;
  cleared: number;
  failed: number;
  onHold: number;
}

export interface DashboardSummaryDto extends Freshness {
  today: StatusCounts;
  range: StatusCounts;
}

export interface CheckpointDeviationDto {
  checkpoint: Checkpoint;
  count: number;
}

export interface DeviationsDto extends Freshness {
  checkpoints: CheckpointDeviationDto[];
}

export interface TrendPointDto {
  date: string;
  productLine: ProductLine;
  batchCount: number;
  clearedCount: number;
  failedCount: number;
  // failed / batchCount, a fraction from 0 to 1, not a percentage: pending and on-hold batches
  // count, so a day still being decided reads low. Null only when the day has no batches.
  failRate: number | null;
}

export interface TrendDto extends Freshness {
  points: TrendPointDto[];
}

export interface FailureReasonDto {
  reasonCode: string;
  count: number;
}

export interface FailureReasonsDto extends Freshness {
  reasons: FailureReasonDto[];
}

export interface MarginalSocietyDto {
  societyCode: string;
  societyName: string | null;
  consignmentCount: number;
  batchCount: number;
  // Null when none of the society's consignments could be scored; those come last.
  tightestMargin: number | null;
  tightestMeasure: string | null;
}

export interface MarginalSocietiesDto extends Freshness {
  societies: MarginalSocietyDto[];
  source: string;
  coverage: string;
}

export interface RecentFailureDto {
  batchId: string;
  batchReference: string | null;
  productLine: ProductLine;
  facility: string;
  // The batch's latest event, UTC: when the failure was recorded.
  failedAt: string;
  reasonCodes: string[];
  tracePath: string;
}

export interface RecentFailuresDto extends Freshness {
  batches: RecentFailureDto[];
}

// ── API calls ────────────────────────────────────────────────────────────────

function withFilters(path: string, filters: DashboardFilters): string {
  const query = new URLSearchParams();

  if (filters.facility) {
    query.set("facility", filters.facility);
  }

  if (filters.productLine) {
    query.set("productLine", filters.productLine);
  }

  if (filters.from) {
    query.set("from", filters.from);
  }

  if (filters.to) {
    query.set("to", filters.to);
  }

  const qs = query.toString();

  return qs ? `${path}?${qs}` : path;
}

export function getDashboardSummary(filters: DashboardFilters, token: string | null, signal?: AbortSignal) {
  return request<DashboardSummaryDto>(withFilters("/api/dashboard/summary", filters), {
    token,
    signal,
    service: "traceability",
  });
}

export function getDeviations(filters: DashboardFilters, token: string | null, signal?: AbortSignal) {
  return request<DeviationsDto>(withFilters("/api/dashboard/deviations", filters), {
    token,
    signal,
    service: "traceability",
  });
}

export function getTrend(filters: DashboardFilters, token: string | null, signal?: AbortSignal) {
  return request<TrendDto>(withFilters("/api/dashboard/trend", filters), {
    token,
    signal,
    service: "traceability",
  });
}

export function getFailureReasons(filters: DashboardFilters, token: string | null, signal?: AbortSignal) {
  return request<FailureReasonsDto>(withFilters("/api/dashboard/failure-reasons", filters), {
    token,
    signal,
    service: "traceability",
  });
}

export function getMarginalSocieties(filters: DashboardFilters, token: string | null, signal?: AbortSignal) {
  return request<MarginalSocietiesDto>(withFilters("/api/dashboard/marginal-societies", filters), {
    token,
    signal,
    service: "traceability",
  });
}

export function getRecentFailures(filters: DashboardFilters, token: string | null, signal?: AbortSignal) {
  return request<RecentFailuresDto>(withFilters("/api/dashboard/recent-failures", filters), {
    token,
    signal,
    service: "traceability",
  });
}
