const BASE_URL = "/api";

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async request<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...init } = options;

    let url = `${BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") searchParams.set(k, String(v));
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(url, { ...init, headers });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return res.json();
  }

  get<T = any>(endpoint: string, params?: Record<string, string | number | undefined>) {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  post<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: "POST", body: JSON.stringify(data) });
  }

  put<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();
