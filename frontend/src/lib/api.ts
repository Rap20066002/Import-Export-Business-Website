export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiFetch<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: FormData | string | Record<string, unknown>;
    token?: string | null;
    isFormData?: boolean;
  } = {}
): Promise<T> {
  const { method = "GET", body, token, isFormData } = options;

  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | null | undefined;
  if (body) {
    requestBody = isFormData ? (body as FormData) : JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    credentials: typeof window !== "undefined" ? "include" : undefined,
  });

  if (!res.ok) {
    let errorMessage = "Request failed";
    try {
      const data: unknown = await res.json();
      if (data && typeof data === "object" && "error" in data) {
        const maybeError = (data as { error?: unknown }).error;
        if (typeof maybeError === "string" && maybeError.trim().length > 0) {
          errorMessage = maybeError;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return (await res.json()) as T;
}

