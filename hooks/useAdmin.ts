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
  type FetchSubmissionsParams,
} from '@/lib/api/admin';
import { useSubmissionsRealtime } from '@/hooks/realtime/useSubmissionsRealtime';
import { useAdminStatsRealtime } from '@/hooks/realtime/useAdminStatsRealtime';

function getSubmissionIdentity(sub: any) {
  return String(sub?.submission_group_id || sub?.id || '');
}

function patchAdminSubmissionCache(queryClient: any, submissionRef: string, nextStatus: 'approved' | 'rejected') {
  queryClient.setQueriesData(
    { queryKey: ['admin', 'submissions'] },
    (oldData: any) => {
      if (!oldData) return oldData;

      const patchList = (items: any[], currentFilter?: string) => {
        const patched = items.map((sub) => {
          const identity = getSubmissionIdentity(sub);

          if (identity !== String(submissionRef)) {
            return sub;
          }

          return {
            ...sub,
            status: nextStatus,
            approved_at: nextStatus === 'approved' ? new Date().toISOString() : sub.approved_at,
            rejected_at: nextStatus === 'rejected' ? new Date().toISOString() : sub.rejected_at,
            updated_at: new Date().toISOString(),
          };
        });

        /*
          Immediate status change:
          If currently viewing pending tab, remove the processed row immediately.
          If viewing approved/rejected/all tab, keep/update it.
        */
        if (currentFilter === 'pending') {
          return patched.filter((sub) => getSubmissionIdentity(sub) !== String(submissionRef));
        }

        if (currentFilter === 'approved' && nextStatus !== 'approved') {
          return patched.filter((sub) => getSubmissionIdentity(sub) !== String(submissionRef));
        }

        if (currentFilter === 'rejected' && nextStatus !== 'rejected') {
          return patched.filter((sub) => getSubmissionIdentity(sub) !== String(submissionRef));
        }

        return patched;
      };

      if (Array.isArray(oldData)) {
        return patchList(oldData);
      }

      if (Array.isArray(oldData.submissions)) {
        const statusFilter = oldData.status || 'pending';
        const nextSubmissions = patchList(oldData.submissions, statusFilter);
        const removed = oldData.submissions.length - nextSubmissions.length;

        return {
          ...oldData,
          submissions: nextSubmissions,
          total: Math.max(0, Number(oldData.total || 0) - Math.max(removed, 0)),
        };
      }

      return oldData;
    },
  );
}


function mapAdminStatsSummaryRow(row: any, previous: any = {}) {
  if (!row || typeof row !== 'object') return previous;

  const totalUsers = Number(row.total_users ?? previous.totalUsers ?? previous.total_users ?? 0);
  const totalSubmissions = Number(row.total_submissions ?? previous.totalSubmissions ?? previous.total_submissions ?? 0);
  const pendingSubmissions = Number(row.pending_submissions ?? previous.pendingSubmissions ?? previous.pending_submissions ?? 0);
  const approvedSubmissions = Number(row.approved_submissions ?? previous.approvedSubmissions ?? previous.approved_submissions ?? 0);
  const rejectedSubmissions = Number(row.rejected_submissions ?? previous.rejectedSubmissions ?? previous.rejected_submissions ?? 0);

  const revenue = Number(row.total_revenue ?? previous.revenue ?? previous.total_revenue ?? 0);
  const pendingAmount = Number(row.pending_amount ?? previous.pendingRevenue ?? previous.pending_amount ?? 0);

  const totalNumbers = Number(row.total_numbers ?? previous.totalNumbers ?? previous.total_numbers ?? previous.gridSize ?? 0);
  const numbersSold = Number(row.sold_numbers ?? previous.numbersSold ?? previous.sold_numbers ?? 0);
  const numbersLeft = Number(row.open_numbers ?? previous.numbersLeft ?? previous.open_numbers ?? 0);
  const pendingNumbers = Number(row.pending_numbers ?? previous.pendingNumbers ?? previous.pending_numbers ?? previous.pendingApprovals ?? 0);

  return {
    ...previous,

    // Admin card fields
    totalUsers,
    numbersSold,
    pendingApprovals: pendingNumbers,
    pendingNumbers,
    revenue,
    numbersLeft,

    // Extra clear fields
    pendingSubmissions,
    totalSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    totalNumbers,
    gridSize: Number(previous.gridSize ?? totalNumbers ?? 0),
    ticketPrice: Number(previous.ticketPrice ?? 0),
    pendingRevenue: pendingAmount,
    updatedAt: row.updated_at ?? previous.updatedAt ?? previous.updated_at ?? null,

    // Snake case compatibility
    total_users: totalUsers,
    sold_numbers: numbersSold,
    pending_numbers: pendingNumbers,
    pending_submissions: pendingSubmissions,
    total_revenue: revenue,
    open_numbers: numbersLeft,
    total_numbers: totalNumbers,
    total_submissions: totalSubmissions,
    approved_submissions: approvedSubmissions,
    rejected_submissions: rejectedSubmissions,
    pending_amount: pendingAmount,
    updated_at: row.updated_at ?? previous.updated_at ?? previous.updatedAt ?? null,
  };
}

function patchAdminStatsCache(
  queryClient: any,
  nextStatus: 'approved' | 'rejected',
  meta: {
    totalAmount?: number;
    soldDelta?: number;
    leftDelta?: number;
  } = {},
) {
  queryClient.setQueriesData(
    { queryKey: ['admin', 'stats'] },
    (oldData: any) => {
      if (!oldData || typeof oldData !== 'object') return oldData;

      const totalAmount = Number(meta.totalAmount || 0);
      const soldDelta = Number(meta.soldDelta || 0);
      const leftDelta = Number(meta.leftDelta || 0);

      const pendingSubmissions = Math.max(
        0,
        Number(oldData.pending_submissions ?? oldData.pendingSubmissions ?? 0) - 1,
      );

      const pendingAmount = Math.max(
        0,
        Number(oldData.pending_amount ?? oldData.pendingAmount ?? 0) - totalAmount,
      );

      const soldNumbers = Math.max(
        0,
        Number(oldData.sold_numbers ?? oldData.soldNumbers ?? 0) + soldDelta,
      );

      const openNumbers = Math.max(
        0,
        Number(
          oldData.open_numbers ??
            oldData.openNumbers ??
            oldData.left_numbers ??
            oldData.leftNumbers ??
            0,
        ) + leftDelta,
      );

      if (nextStatus === 'approved') {
        return {
          ...oldData,

          pending_submissions: pendingSubmissions,
          pendingSubmissions,

          approved_submissions:
            Number(oldData.approved_submissions ?? oldData.approvedSubmissions ?? 0) + 1,
          approvedSubmissions:
            Number(oldData.approvedSubmissions ?? oldData.approved_submissions ?? 0) + 1,

          total_revenue: Number(oldData.total_revenue ?? oldData.totalRevenue ?? 0) + totalAmount,
          totalRevenue: Number(oldData.totalRevenue ?? oldData.total_revenue ?? 0) + totalAmount,

          pending_amount: pendingAmount,
          pendingAmount,

          sold_numbers: soldNumbers,
          soldNumbers,

          open_numbers: openNumbers,
          openNumbers,
          left_numbers: openNumbers,
          leftNumbers: openNumbers,
        };
      }

      return {
        ...oldData,

        pending_submissions: pendingSubmissions,
        pendingSubmissions,

        rejected_submissions:
          Number(oldData.rejected_submissions ?? oldData.rejectedSubmissions ?? 0) + 1,
        rejectedSubmissions:
          Number(oldData.rejectedSubmissions ?? oldData.rejected_submissions ?? 0) + 1,

        pending_amount: pendingAmount,
        pendingAmount,
      };
    },
  );
}


export const useSubmissions = (params: FetchSubmissionsParams = {}) => {
  const queryClient = useQueryClient();

  const refreshAdminAfterSubmissionChange = useCallback(async () => {

    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: ['admin', 'submissions'],
        exact: false,
        refetchType: 'active',
      }),
      queryClient.invalidateQueries({
        queryKey: ['admin', 'stats'],
        exact: false,
        refetchType: 'active',
      }),
    ]);

    await Promise.allSettled([
      queryClient.refetchQueries({
        queryKey: ['admin', 'submissions'],
        exact: false,
        type: 'active',
      }),
      queryClient.refetchQueries({
        queryKey: ['admin', 'stats'],
        exact: false,
        type: 'active',
      }),
    ]);
  }, [queryClient]);

  useSubmissionsRealtime({
    enabled: true,
    debounceMs: 0,
    onChange: refreshAdminAfterSubmissionChange,
  });

  return useQuery({
    queryKey: ['admin', 'submissions', params],
    queryFn: () => fetchSubmissions(params),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    placeholderData: (previousData: any) => previousData,
  });
};

export const useStats = () => {
  const queryClient = useQueryClient();

  const refreshStats = useCallback(async () => {

    await queryClient.invalidateQueries({
      queryKey: ['admin', 'stats'],
      exact: false,
      refetchType: 'active',
    });

    await queryClient.refetchQueries({
      queryKey: ['admin', 'stats'],
      exact: false,
      type: 'active',
    });
  }, [queryClient]);

  useAdminStatsRealtime({
    enabled: true,
    debounceMs: 0,
    onChange: refreshStats,
  });

  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchStats,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
};

export const useApproveSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveSubmission,
    onSuccess: (data: any, id: string) => {
      const submissionRef = String(data?.submissionRef || id);
      patchAdminSubmissionCache(queryClient, submissionRef, 'approved');
      patchAdminStatsCache(queryClient, 'approved', data);
    },
  });
};

export const useRejectSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectSubmission,
    onSuccess: (data: any, id: string) => {
      const submissionRef = String(data?.submissionRef || id);
      patchAdminSubmissionCache(queryClient, submissionRef, 'rejected');
      patchAdminStatsCache(queryClient, 'rejected', data);
    },
  });
};

export const useClearAllSubmissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAllSubmissions,
    onSuccess: () => {
      queryClient.setQueriesData({ queryKey: ['admin', 'submissions'] }, (oldData: any) => {
        if (!oldData) return oldData;
        if (Array.isArray(oldData)) return [];
        if (Array.isArray(oldData.submissions)) {
          return {
            ...oldData,
            submissions: [],
            total: 0,
            totalPages: 1,
            page: 1,
          };
        }
        return oldData;
      });

      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
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
