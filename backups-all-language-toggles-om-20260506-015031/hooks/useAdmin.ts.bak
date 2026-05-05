'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSubmissions,
  fetchStats,
  approveSubmission,
  rejectSubmission,
  clearAllSubmissions,
  drawWinner,
} from '@/lib/api/admin';

export const useSubmissions = () => {
  return useQuery({
    queryKey: ['admin', 'submissions'],
    queryFn: fetchSubmissions,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
};

export const useStats = () => {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchStats,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
};

export const useApproveSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      await queryClient.invalidateQueries({ queryKey: ['numbers'] });
      await queryClient.refetchQueries({ queryKey: ['admin', 'submissions'] });
      await queryClient.refetchQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useRejectSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      await queryClient.invalidateQueries({ queryKey: ['numbers'] });
      await queryClient.refetchQueries({ queryKey: ['admin', 'submissions'] });
      await queryClient.refetchQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useClearAllSubmissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAllSubmissions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      await queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
};

export const useDrawWinner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: drawWinner,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'winners'] });
    },
  });
};
