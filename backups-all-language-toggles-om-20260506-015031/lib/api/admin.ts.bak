'use client';

import { apiFetch } from '@/lib/auth/client';

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export async function fetchSubmissions() {
  const res = await apiFetch(`/api/admin/submissions?t=${Date.now()}`);
  const data = await readJson(res);

  if (Array.isArray(data)) return data;
  return data.submissions || [];
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
