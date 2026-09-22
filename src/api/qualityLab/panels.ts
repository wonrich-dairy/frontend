import { request } from "../http";

// ── Types ────────────────────────────────────────────────────────────────────

export type ProductLine = "FM" | "FLM" | "SY" | "SK" | "DY" | "CD";

export const PRODUCT_LINES: ProductLine[] = ["FM", "FLM", "SY", "SK", "DY", "CD"];

export const PRODUCT_LINE_LABEL: Record<ProductLine, string> = {
  FM: "Fresh Milk",
  FLM: "Flavoured Milk",
  SY: "Set Yogurt",
  SK: "Set Kiri",
  DY: "Drinking Yogurt",
  CD: "Curd",
};

export const LIQUID_LINES: ProductLine[] = ["FM", "FLM"];
export const FERMENTED_LINES: ProductLine[] = ["SY", "SK", "DY", "CD"];

export function isLiquid(line: ProductLine): boolean {
  return LIQUID_LINES.includes(line);
}

export function isFermented(line: ProductLine): boolean {
  return FERMENTED_LINES.includes(line);
}

export interface BatchWorkItemDto {
  id: string;
  batchCode: string;
  dispatchNumber: string;
  productLine: ProductLine;
  storingTankCode: string | null;
  status: string;
  completionTimeUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  hasPanels: boolean;
  latestPanelVersion: number;
  hasSensory: boolean;
  hasDetermination: boolean;
}

export interface ChemicalPanelDto {
  id: string;
  batchWorkItemId: string;
  batchCode: string;
  dispatchNumber: string;
  productLine: ProductLine;
  fatPercent: number;
  lactometerReading: number | null;
  temperatureCelsius: number | null;
  ph: number;
  correctedClr: number | null;
  snf: number | null;
  ts: number | null;
  version: number;
  hasOutOfSpecFlags: boolean;
  outOfSpecFlagsJson: string | null;
  testedBy: string;
  testedAtUtc: string;
  createdAtUtc: string;
  isLocked: boolean;
}

export interface RecordPanelRequest {
  fatPercent: number;
  lactometerReading?: number;
  temperatureCelsius?: number;
  ph: number;
}

export interface CreateBatchRequest {
  batchCode: string;
  dispatchNumber: string;
  productLine: string;
  storingTankCode?: string;
}

export interface ProductLineFieldsDto {
  productLine: ProductLine;
  isLiquid: boolean;
  isFermented: boolean;
  hasTexture: boolean;
  fields: string[];
  derivedFields: string[];
}

// ── API calls ────────────────────────────────────────────────────────────────

export function getWorkQueue(token: string | null, signal?: AbortSignal) {
  return request<BatchWorkItemDto[]>("/api/panels/work-queue", {
    token,
    signal,
    service: "qualityLab",
  });
}

export function getBatch(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<BatchWorkItemDto>(`/api/panels/batch/${encodeURIComponent(batchCode)}`, {
    token,
    signal,
    service: "qualityLab",
  });
}

export function createBatch(body: CreateBatchRequest, token: string | null) {
  return request<BatchWorkItemDto>("/api/panels/batch", {
    method: "POST",
    body,
    token,
    service: "qualityLab",
  });
}

export function recordPanel(batchCode: string, body: RecordPanelRequest, token: string | null) {
  return request<ChemicalPanelDto>(`/api/panels/${encodeURIComponent(batchCode)}`, {
    method: "POST",
    body,
    token,
    service: "qualityLab",
  });
}

export function getLatestPanel(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<ChemicalPanelDto>(`/api/panels/${encodeURIComponent(batchCode)}`, {
    token,
    signal,
    service: "qualityLab",
  });
}

export function getPanelVersions(batchCode: string, token: string | null, signal?: AbortSignal) {
  return request<ChemicalPanelDto[]>(`/api/panels/${encodeURIComponent(batchCode)}/versions`, {
    token,
    signal,
    service: "qualityLab",
  });
}

export function getFieldsForProductLine(productLine: string, signal?: AbortSignal) {
  return request<ProductLineFieldsDto>(`/api/panels/fields/${encodeURIComponent(productLine)}`, {
    signal,
    service: "qualityLab",
  });
}
