'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/auth/client';

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export function useMySubmissions() {
  return useQuery({
    queryKey: ['user', 'submissions'],
    queryFn: async () => {
      const res = await apiFetch(`/api/user/submissions?t=${Date.now()}`);
      return readJson(res);
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}

export function useNumbers() {
  return useQuery({
    queryKey: ['numbers'],
    queryFn: async () => {
      const res = await fetch(`/api/numbers?t=${Date.now()}`, {
        cache: 'no-store',
      });

      return readJson(res);
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}

export function useSubmitNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      number,
      receiptUrl,
    }: {
      number: number;
      receiptUrl: string;
    }) => {
      const res = await apiFetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, receiptUrl }),
      });

      return readJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'submissions'] });
    },
  });
}
