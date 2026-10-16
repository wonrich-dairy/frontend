import { COLOMBO_TZ } from "../../../utils/time";
import { PRODUCT_LINES, type DashboardFilters, type ProductLine } from "../../../api/traceability/dashboard";

// The dashboard's filters live in the URL, so a refresh or a shared link keeps the view.
// Everything here is pure; the screen only reads and writes the query string.

export interface QcoFilters {
  productLine: ProductLine | "";
  from: string;
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Today as the plant sees it, not as the browser's own time zone does.
export function todayInColombo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// The range opens on the most recent 1 August, so the dashboard starts on the season to date.
// Before August that is last year's, so the start is never after today.
export function seasonStart(now: Date = new Date()): string {
  const today = todayInColombo(now);
  const year = Number(today.slice(0, 4));

  return today.slice(5) >= "08-01" ? `${year}-08-01` : `${year - 1}-08-01`;
}

export function defaultFilters(now: Date = new Date()): QcoFilters {
  return { productLine: "", from: seasonStart(now), to: todayInColombo(now) };
}

export function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function rangeError(filters: Pick<QcoFilters, "from" | "to">): string | null {
  if (!isValidDate(filters.from) || !isValidDate(filters.to)) {
    return "Enter both dates.";
  }

  // ISO dates compare correctly as strings.
  return filters.from <= filters.to ? null : "The start date must be on or before the end date.";
}

function isProductLine(value: string): value is ProductLine {
  return (PRODUCT_LINES as readonly string[]).includes(value);
}

// Anything unreadable in a hand-edited link falls back to the default rather than failing.
export function filtersFromQuery(query: URLSearchParams, now: Date = new Date()): QcoFilters {
  const defaults = defaultFilters(now);
  const productLine = query.get("productLine") ?? "";
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";

  const range = { from: isValidDate(from) ? from : defaults.from, to: isValidDate(to) ? to : defaults.to };

  return {
    productLine: isProductLine(productLine) ? productLine : "",
    ...(rangeError(range) ? { from: defaults.from, to: defaults.to } : range),
  };
}

// Only what differs from the default goes in the URL, so the plain /qco link means 1 August to today.
export function filtersToQuery(filters: QcoFilters, now: Date = new Date()): string {
  const defaults = defaultFilters(now);
  const query = new URLSearchParams();

  if (filters.productLine) {
    query.set("productLine", filters.productLine);
  }

  if (filters.from !== defaults.from || filters.to !== defaults.to) {
    query.set("from", filters.from);
    query.set("to", filters.to);
  }

  const qs = query.toString();

  return qs ? `?${qs}` : "";
}

export function toRequestFilters(filters: QcoFilters): DashboardFilters {
  return {
    productLine: filters.productLine || undefined,
    from: filters.from,
    to: filters.to,
  };
}

export function isToday(filters: QcoFilters, now: Date = new Date()): boolean {
  const today = todayInColombo(now);

  return filters.from === today && filters.to === today;
}

// Fixed names rather than Intl: ICU versions disagree on "Sep" and "Sept", and the summary
// should read the same on every phone.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string, withYear: boolean): string {
  const [year, month, day] = iso.split("-").map(Number);

  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ""}`;
}

// One line saying what the dashboard is showing, for the collapsed filter bar on a phone.
export function describeFilters(filters: QcoFilters, now: Date = new Date()): string {
  const dates = isToday(filters, now) ? "Today" : describeDateRange(filters, now);

  return [dates, filters.productLine || "All lines"].join(" · ");
}

export function describeDateRange(filters: Pick<QcoFilters, "from" | "to">, now: Date = new Date()): string {
  const thisYear = todayInColombo(now).slice(0, 4);
  const withYear = filters.from.slice(0, 4) !== thisYear || filters.to.slice(0, 4) !== thisYear;

  return filters.from === filters.to
    ? shortDate(filters.from, withYear)
    : `${shortDate(filters.from, withYear)} to ${shortDate(filters.to, withYear)}`;
}
