import type { ProblemDetails } from "./types";

/** A refusal from the service, carrying the parts of the problem body worth showing. */
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

const baseUrl = (import.meta.env.VITE_INTAKE_API_URL ?? "http://localhost:5237").replace(/\/$/, "");

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
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
    // Offline at the gate is ordinary, so it reads as a condition rather than a crash.
    throw new ApiError(0, "network_unavailable", "Cannot reach the intake service. Check the connection and try again.");
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

/**
 * Turns a problem body into one sentence for the officer. Validation failures are flattened
 * because the service reports them per field and the screen has one message area.
 */
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
    return "Your role is not permitted to register consignments.";
  }

  return "The consignment could not be registered. Try again.";
}
