import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { getBatch, getBatchTrace, type BatchRecordDto, type BatchTraceDto } from "../../../api/traceability/batches";

export type BatchLoad<T = BatchRecordDto> =
  | { status: "loading" }
  | { status: "ready"; batch: T }
  | { status: "notFound" }
  | { status: "error"; message: string };

type Fetcher<T> = (batchId: string, token: string | null, signal: AbortSignal) => Promise<T>;

function useBatchLoad<T>(batchId: string, token: string | null, fetcher: Fetcher<T>): BatchLoad<T> {
  const [state, setState] = useState<{ batchId: string; load: BatchLoad<T> }>({ batchId, load: { status: "loading" } });

  useEffect(() => {
    const controller = new AbortController();

    fetcher(batchId, token, controller.signal).then(
      (batch) => setState({ batchId, load: { status: "ready", batch } }),
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          batchId,
          load:
            error instanceof ApiError && error.status === 404
              ? { status: "notFound" }
              : { status: "error", message: error instanceof ApiError ? error.message : "This batch could not be loaded." },
        });
      },
    );

    return () => controller.abort();
  }, [batchId, token, fetcher]);

  // A record for the previous batch is never shown under the new one's ID.
  return state.batchId === batchId ? state.load : { status: "loading" };
}

export function useBatchRecord(batchId: string, token: string | null): BatchLoad {
  return useBatchLoad(batchId, token, getBatch);
}

export function useBatchTrace(batchId: string, token: string | null): BatchLoad<BatchTraceDto> {
  return useBatchLoad(batchId, token, getBatchTrace);
}
