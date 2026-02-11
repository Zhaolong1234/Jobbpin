import { API_BASE_URL } from "@/lib/config";

interface ApiErrorBody {
  message?: string;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.message) return body.message;
  } catch {}
  return `Request failed with status ${res.status}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  return (await res.json()) as T;
}
