import type { ProblemDetails } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly problem: ProblemDetails | undefined;

  constructor(status: number, code: string | undefined, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

const intakeBaseUrl = (import.meta.env.VITE_INTAKE_API_URL ?? "http://localhost:5237").replace(/\/$/, "");

const processingBaseUrl = (
  import.meta.env.VITE_PROCESSING_API_URL ?? "http://localhost:5239"
).replace(/\/$/, "");

export type ServiceName = "intake" | "processing";

const BASE_URLS: Record<ServiceName, string> = {
  intake: intakeBaseUrl,
  processing: processingBaseUrl,
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  service?: ServiceName;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal, service = "intake" } = options;

  let response: Response;

  try {
    response = await fetch(`${BASE_URLS[service]}${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      "network_unavailable",
      "Cannot reach the service. Check the connection and try again.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const problem = (payload ?? {}) as ProblemDetails;

  const fieldErrors = Object.values(problem.errors ?? {})
    .flat()
    .filter(Boolean);

  const message =
    fieldErrors.length > 0
      ? fieldErrors.join(" ")
      : problem.detail ?? problem.title ?? defaultMessage(status);

  return new ApiError(status, problem.code, message, problem);
}

function defaultMessage(status: number): string {
  if (status === 401) {
    return "Your session has expired. Sign in again.";
  }

  if (status === 403) {
    return "Your role does not allow this.";
  }

  if (status === 404) {
    return "That record could not be found.";
  }

  if (status >= 500) {
    return "The service is having trouble. Try again in a moment.";
  }

  return "That could not be saved. Try again.";
}
