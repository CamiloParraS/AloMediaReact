// Base URL 

const BASE_URL = import.meta.env.VITE_BASE_URL;

// Payload types 

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// Response types

/** Shape returned by POST /auth/login and POST /auth/register */
export interface AuthResponse {
  token: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

/** Shape returned by GET /auth/me */
export interface MeResponse {
  authenticated: boolean;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

// Error types 

export interface FieldError {
  field: string;
  message: string;
}

/** Thrown when the API returns a non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldError[];

  constructor(message: string, status: number, fields: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }

  /** Returns the error message for a specific field, or undefined. */
  fieldMessage(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

// Helpers 

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      message?: string;
      errors?: FieldError[];
      status?: number;
    };
    throw new ApiError(
      body.message ?? `HTTP ${res.status}`,
      body.status ?? res.status,
      body.errors ?? [],
    );
  }
  return res.json() as Promise<T>;
}

// Requests 

/**
 * POST /auth/login
 * Body: { email, password }
 */
export async function loginRequest(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include", // Include cookies for session management
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}

/**
 * POST /auth/register
 * Body: { firstName, lastName, email, password }
 */
export async function registerRequest(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}

/**
 * GET /auth/me
 * Verifies the current session using the HttpOnly cookie.
 * Returns { authenticated, user } — does NOT include a new token.
 */
export async function meRequest(): Promise<MeResponse> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse<MeResponse>(res);
}

/**
 * POST /auth/logout
 * Clears the HttpOnly auth cookie on the server.
 */
export async function logoutRequest(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new ApiError(`Logout failed: HTTP ${res.status}`, res.status);
  }
}
