import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const IS_MOCK = import.meta.env.VITE_AUTH_MOCK === "true";

async function getToken() {
  if (IS_MOCK) return "mock-jwt-token";
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = await getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;
}

export const api = {
  // Files
  listFiles: () => request("/files"),
  getFile: (key) => request(`/files/detail?key=${encodeURIComponent(key)}`),
  uploadFile: (filename, content, vicerrectoria) =>
    request("/files", {
      method: "POST",
      body: JSON.stringify({ filename, content, ...(vicerrectoria && { vicerrectoria }) }),
    }),
  updateFile: (key, content) =>
    request("/files/detail", {
      method: "PUT",
      body: JSON.stringify({ key, content }),
    }),
  deleteFile: (key) =>
    request("/files/detail", {
      method: "DELETE",
      body: JSON.stringify({ key }),
    }),

  // Audit
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`/audit${query ? `?${query}` : ""}`);
  },
};
