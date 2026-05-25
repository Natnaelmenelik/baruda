'use client';

import { apiFetch } from '@/lib/auth/client';

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export type AdminSubmissionStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export type FetchSubmissionsParams = {
  page?: number;
  limit?: number;
  status?: AdminSubmissionStatusFilter;
  search?: string;
};

export async function fetchSubmissions(params: FetchSubmissionsParams = {}) {
  const query = new URLSearchParams();
  query.set('t', String(Date.now()));
  query.set('page', String(params.page || 1));
  query.set('limit', String(params.limit || 20));
  query.set('status', params.status || 'pending');
  if (params.search?.trim()) query.set('search', params.search.trim());

  const res = await apiFetch(`/api/admin/submissions?${query.toString()}`);
  const data = await readJson(res);

  if (Array.isArray(data)) {
    return {
      submissions: data,
      page: 1,
      limit: data.length,
      total: data.length,
      totalPages: 1,
      status: params.status || 'pending',
      search: params.search || '',
    };
  }

  return {
    submissions: data.submissions || [],
    page: Number(data.page || params.page || 1),
    limit: Number(data.limit || params.limit || 20),
    total: Number(data.total || 0),
    totalPages: Number(data.totalPages || 1),
    status: data.status || params.status || 'pending',
    search: data.search || params.search || '',
  };
}

export async function fetchStats() {
  const res = await apiFetch(`/api/admin/stats?t=${Date.now()}`);
  return readJson(res);
}

export async function approveSubmission(id: string) {
  const res = await apiFetch(`/api/admin/approve/${id}?t=${Date.now()}`, {
    method: 'POST',
  });

  return readJson(res);
}

export async function rejectSubmission(id: string) {
  const res = await apiFetch(`/api/admin/reject/${id}?t=${Date.now()}`, {
    method: 'POST',
  });

  return readJson(res);
}

export async function clearAllSubmissions() {
  const res = await apiFetch(`/api/admin/clear-all?t=${Date.now()}`, {
    method: 'POST',
  });

  return readJson(res);
}

export async function drawWinner() {
  const res = await apiFetch(`/api/admin/draw?t=${Date.now()}`, {
    method: 'POST',
  });

  return readJson(res);
}

export async function fetchReceipt(submissionId: string) {
  const res = await apiFetch(
    `/api/admin/submissions/${submissionId}/receipt?t=${Date.now()}`
  );

  return readJson(res);
}

export async function fetchWinners() {
  const res = await apiFetch(`/api/admin/winners?t=${Date.now()}`);
  return readJson(res);
}
