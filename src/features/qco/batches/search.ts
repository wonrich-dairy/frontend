import { ApiError } from "../../../api/http";
import { findBatches, getBatch, type BatchSummaryDto } from "../../../api/traceability/batches";

export type SearchKind = "batchId" | "batchReference" | "dispatchRef";

export interface SearchTerm {
  kind: SearchKind;
  value: string;
}

export function batchPath(batchId: string): string {
  return `/qco/batches/${encodeURIComponent(batchId)}`;
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  batchId: "batch ID",
  batchReference: "batch reference",
  dispatchRef: "dispatch reference",
};

// Processing's batch code: production day, product line, letter, e.g. 262-FM-B.
const BATCH_ID = /^\d{3}-[A-Z]{2,3}-[A-Z]+$/;
const BATCH_REFERENCE_PREFIX = "WR-";

// Which lookup a typed term is for. The three identifiers do not overlap: factory intake's batch
// references start WR-, batch IDs have their own shape, and anything else is taken as the MCC
// dispatch number (DN-...). All three are upper case, so a term typed in lower case still matches.
export function classifySearch(raw: string): SearchTerm | { error: string } {
  const value = raw.trim().toUpperCase();

  if (value === "") {
    return { error: "Enter a batch ID, a dispatch reference or a WR- batch reference." };
  }

  if (value.startsWith(BATCH_REFERENCE_PREFIX)) {
    return value.length > BATCH_REFERENCE_PREFIX.length
      ? { kind: "batchReference", value }
      : { error: "Enter the whole batch reference, e.g. WR-20260919-02." };
  }

  if (BATCH_ID.test(value)) {
    return { kind: "batchId", value };
  }

  return { kind: "dispatchRef", value };
}

// The batches a term matches, oldest first. No match is an empty list for every kind of term: a
// batch ID the service has never seen comes back as a 404, which is turned into "nothing found"
// here rather than shown as an error. Any other failure is thrown.
export async function searchBatches(
  term: SearchTerm,
  token: string | null,
  signal?: AbortSignal,
): Promise<BatchSummaryDto[]> {
  if (term.kind === "batchId") {
    try {
      return [await getBatch(term.value, token, signal)];
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return [];
      }

      throw error;
    }
  }

  return findBatches(
    term.kind === "batchReference" ? { batchReference: term.value } : { dispatchRef: term.value },
    token,
    signal,
  );
}
