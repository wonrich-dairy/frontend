import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import { getBatch, type BatchRecordDto } from "../../../api/traceability/batches";

export type BatchLoad =
  | { status: "loading" }
  | { status: "ready"; batch: BatchRecordDto }
  | { status: "notFound" }
  | { status: "error"; message: string };

export function useBatchRecord(batchId: string, token: string | null): BatchLoad {
  const [state, setState] = useState<{ batchId: string; load: BatchLoad }>({ batchId, load: { status: "loading" } });

  useEffect(() => {
    const controller = new AbortController();

    getBatch(batchId, token, controller.signal).then(
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
  }, [batchId, token]);

  // A record for the previous batch is never shown under the new one's ID.
  return state.batchId === batchId ? state.load : { status: "loading" };
}
