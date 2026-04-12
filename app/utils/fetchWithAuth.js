import { loadSession, isTokenValid, clearSession } from "@/lib/auth";

export default async function fetchWithAuth(url, options = {}) {
  const session = loadSession();
  const token = session?.token || null;

  if (!token || !isTokenValid(token)) {
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Token expired or invalid');
  }

  const opts = { ...(options || {}), headers: { ...(options?.headers || {}) } };
  if (url.startsWith('/api') && !url.startsWith('/api/login')) {
    opts.headers['Authorization'] = 'Bearer ' + token;
  }
  // לא מגדירים Content-Type אם body הוא FormData
  if (!opts.headers['Content-Type'] && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, opts);
  if (response?.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/login';
    return;
  }
  return response;
}

