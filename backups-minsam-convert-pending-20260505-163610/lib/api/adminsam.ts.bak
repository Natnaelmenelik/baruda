import {
  fetchSubmissions,
  fetchStats,
  approveSubmission,
  rejectSubmission,
  clearAllSubmissions,
  drawWinner,
  fetchReceipt,
  fetchWinners,
} from './admin';

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const token = getToken();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
}

export {
  fetchSubmissions,
  fetchStats,
  approveSubmission,
  rejectSubmission,
  clearAllSubmissions,
  drawWinner,
  fetchReceipt,
  fetchWinners,
};

export async function rejectApprovedSubmission(id: string) {
  const res = await apiFetch(
    `/api/minsam/submissions/${id}/reject-approved?t=${Date.now()}`,
    {
      method: 'PATCH',
    }
  );

  return readJson(res);
}
