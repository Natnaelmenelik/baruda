'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSubmissions,
  fetchStats,
  approveSubmission,
  rejectSubmission,
  clearAllSubmissions,
  drawWinner,
  
  returnApprovedToPendingSubmission,
} from '@/lib/api/adminsam';

export const useMinsamSubmissions = () => {
  return useQuery({
    queryKey: ['minsam', 'submissions'],
    queryFn: () => fetchSubmissions(),
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export const useMinsamStats = () => {
  return useQuery({
    queryKey: ['minsam', 'stats'],
    queryFn: () => fetchStats(),
    refetchOnWindowFocus: false,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  });
};

export const useMinsamApproveSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minsam', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useMinsamRejectSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minsam', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useMinsamClearAllSubmissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAllSubmissions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minsam', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'winners'] });
    },
  });
};

export const useMinsamDrawWinner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: drawWinner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'winners'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'submissions'] });
    },
  });
};



export const useMinsamReturnApprovedToPendingSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: returnApprovedToPendingSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minsam', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};
