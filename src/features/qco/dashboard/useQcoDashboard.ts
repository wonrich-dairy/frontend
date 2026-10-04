import { useEffect, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  getDashboardSummary,
  getDeviations,
  getFailureReasons,
  getMarginalSocieties,
  getRecentFailures,
  getTrend,
  type DashboardFilters,
  type DashboardSummaryDto,
  type DeviationsDto,
  type FailureReasonsDto,
  type MarginalSocietiesDto,
  type RecentFailuresDto,
  type TrendDto,
} from "../../../api/traceability/dashboard";

export const REFRESH_MS = 30_000;

export type Panel<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export interface DashboardPanels {
  summary: Panel<DashboardSummaryDto>;
  deviations: Panel<DeviationsDto>;
  trend: Panel<TrendDto>;
  failureReasons: Panel<FailureReasonsDto>;
  marginalSocieties: Panel<MarginalSocietiesDto>;
  recentFailures: Panel<RecentFailuresDto>;
}

export type PanelKey = keyof DashboardPanels;

type PanelData<K extends PanelKey> = DashboardPanels[K] extends Panel<infer T> ? T : never;

const LOADERS: {
  [K in PanelKey]: (filters: DashboardFilters, token: string | null, signal: AbortSignal) => Promise<PanelData<K>>;
} = {
  summary: getDashboardSummary,
  deviations: getDeviations,
  trend: getTrend,
  failureReasons: getFailureReasons,
  marginalSocieties: getMarginalSocieties,
  recentFailures: getRecentFailures,
};

const LOADING: DashboardPanels = {
  summary: { status: "loading" },
  deviations: { status: "loading" },
  trend: { status: "loading" },
  failureReasons: { status: "loading" },
  marginalSocieties: { status: "loading" },
  recentFailures: { status: "loading" },
};

function settle<T>(result: PromiseSettledResult<T>, previous: Panel<T>): Panel<T> {
  if (result.status === "fulfilled") {
    return { status: "ready", data: result.value };
  }

  // A failed refresh keeps the figures already on screen; the freshness time says how old they are.
  if (previous.status === "ready") {
    return previous;
  }

  const reason = result.reason;

  return { status: "error", message: reason instanceof ApiError ? reason.message : "This panel could not be loaded." };
}

// Loads only the panels a tab shows. Each one loads and fails on its own, so one endpoint
// down does not blank the dashboard. Refreshes on an interval while the page is visible, and
// stops while it is hidden to save battery and data on the phones the officers carry.
export function useQcoDashboard(
  filters: DashboardFilters,
  token: string | null,
  which: readonly PanelKey[],
): DashboardPanels {
  const key = JSON.stringify({ filters, which });
  const [state, setState] = useState<{ key: string; panels: DashboardPanels }>({ key, panels: LOADING });

  useEffect(() => {
    const { filters: requestFilters, which: keys } = JSON.parse(key) as { filters: DashboardFilters; which: PanelKey[] };
    let controller: AbortController | null = null;
    let timer: number | undefined;

    const load = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const { signal } = current;

      void Promise.allSettled(keys.map((panel) => LOADERS[panel](requestFilters, token, signal))).then((results) => {
        if (signal.aborted) {
          return;
        }

        setState((prev) => {
          const before = prev.key === key ? prev.panels : LOADING;
          const panels: Record<PanelKey, Panel<unknown>> = { ...before };

          keys.forEach((panel, index) => {
            panels[panel] = settle(results[index], before[panel] as Panel<unknown>);
          });

          return { key, panels: panels as DashboardPanels };
        });
      });
    };

    const start = () => {
      load();
      timer = window.setInterval(load, REFRESH_MS);
    };

    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
      controller?.abort();
    };

    const onVisibilityChange = () => {
      stop();

      if (!document.hidden) {
        start();
      }
    };

    if (!document.hidden) {
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [key, token]);

  // Figures from the previous filters are never shown under new ones.
  return state.key === key ? state.panels : LOADING;
}

// The oldest freshness time across the panels: every figure on screen is at least that current.
export function dataAsOf(panels: DashboardPanels): string | null {
  const times = Object.values(panels)
    .filter((panel): panel is { status: "ready"; data: { dataAsOfUtc: string | null } } => panel.status === "ready")
    .map((panel) => panel.data.dataAsOfUtc)
    .filter((time): time is string => Boolean(time));

  if (times.length === 0) {
    return null;
  }

  return times.reduce((oldest, time) => (Date.parse(time) < Date.parse(oldest) ? time : oldest));
}
