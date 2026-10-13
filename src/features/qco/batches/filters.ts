import type { BatchSearchFilters, BatchStatus } from "../../../api/traceability/batches";
import { PRODUCT_LINES, type ProductLine } from "../../../api/traceability/dashboard";
import { isValidDate } from "../dashboard/filters";
import { STATUS_LABELS } from "./trace";

// The batch filter search (SCRUM-139) keeps its filters and page in the URL, so coming back from
// a batch, refreshing or sharing the link shows the same page. Pure: the screen only reads and
// writes the query string.

export interface BatchFilters {
  status: BatchStatus | "";
  productLine: ProductLine | "";
  from: string;
  to: string;
  society: string;
  tank: string;
  user: string;
  reasonCode: string;
  facility: string;
}

export const BATCH_STATUSES = Object.keys(STATUS_LABELS) as BatchStatus[];

// The text filters, in form order. The service matches society, tank and user without regard to case.
const TEXT_KEYS = ["society", "tank", "user", "reasonCode", "facility"] as const;

// The URL always carries the page once a filter search has run, so ?page=1 alone means "every
// batch" and a plain /qco/batches is the lookup form with nothing searched yet.
const PAGE = "page";

export function emptyFilters(): BatchFilters {
  return { status: "", productLine: "", from: "", to: "", society: "", tank: "", user: "", reasonCode: "", facility: "" };
}

export function hasFilterSearch(query: URLSearchParams): boolean {
  return query.has(PAGE);
}

function isStatus(value: string): value is BatchStatus {
  return (BATCH_STATUSES as string[]).includes(value);
}

function isProductLine(value: string): value is ProductLine {
  return (PRODUCT_LINES as readonly string[]).includes(value);
}

// Anything unreadable in a hand-edited link is dropped rather than failing the search.
export function filtersFromQuery(query: URLSearchParams): { filters: BatchFilters; page: number } {
  const status = query.get("status") ?? "";
  const productLine = (query.get("productLine") ?? "").toUpperCase();
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  const page = Number(query.get(PAGE));

  const filters: BatchFilters = {
    ...emptyFilters(),
    status: isStatus(status) ? status : "",
    productLine: isProductLine(productLine) ? productLine : "",
    from: isValidDate(from) ? from : "",
    to: isValidDate(to) ? to : "",
  };

  for (const key of TEXT_KEYS) {
    filters[key] = (query.get(key) ?? "").trim();
  }

  if (rangeError(filters)) {
    filters.from = "";
    filters.to = "";
  }

  return { filters, page: Number.isInteger(page) && page >= 1 ? page : 1 };
}

// Only the filters given go in the URL, then the page.
export function filtersToQuery(filters: BatchFilters, page = 1): string {
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(toRequestFilters(filters))) {
    if (value) {
      query.set(name, value);
    }
  }

  query.set(PAGE, String(page));

  return `?${query.toString()}`;
}

export function toRequestFilters(filters: BatchFilters): BatchSearchFilters {
  const request: BatchSearchFilters = {};

  if (filters.status) request.status = filters.status;
  if (filters.productLine) request.productLine = filters.productLine;
  if (filters.from) request.from = filters.from;
  if (filters.to) request.to = filters.to;

  for (const key of TEXT_KEYS) {
    const value = filters[key].trim();

    if (value) {
      request[key] = value;
    }
  }

  return request;
}

// Both dates are optional, but one given must be whole, and from cannot come after to.
export function rangeError(filters: Pick<BatchFilters, "from" | "to">): string | null {
  if ((filters.from && !isValidDate(filters.from)) || (filters.to && !isValidDate(filters.to))) {
    return "Enter a whole date, or leave it empty.";
  }

  // ISO dates compare correctly as strings.
  return filters.from && filters.to && filters.from > filters.to ? "The start date must be on or before the end date." : null;
}

// "Showing 51–100 of 123 batches", for the line above the results.
export function describePage(page: number, pageSize: number, shown: number, total: number): string {
  const first = (page - 1) * pageSize + 1;
  const noun = total === 1 ? "batch" : "batches";

  return shown === total ? `${total} ${noun}, newest first.` : `Showing ${first}–${first + shown - 1} of ${total} ${noun}, newest first.`;
}
