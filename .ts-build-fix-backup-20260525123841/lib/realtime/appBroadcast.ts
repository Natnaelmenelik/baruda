'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const APP_LIVE_CHANNEL = 'app-live';

export type DashboardMessageBroadcastPayload = {
  id: string;
  text: string;
  message?: string;
  createdAt?: string;
  expiresAt?: string;
};

export type WinnerAnnouncementBroadcastPayload = {
  id: string;
  first_number: number;
  second_number: number;
  third_number: number;
  expires_at: string;
  created_at: string;
};

async function sendAppBroadcast(event: string, payload: any) {
  const supabase = getSupabaseBrowserClient();

  const channel = supabase.channel(APP_LIVE_CHANNEL, {
    config: { broadcast: { self: true } },
  });

  const status = await channel.subscribe();

  if (status !== 'SUBSCRIBED') {
    setTimeout(() => supabase.removeChannel(channel), 250);
    return;
  }

  await channel.send({
    type: 'broadcast',
    event,
    payload: {
      ...payload,
      at: payload?.at || new Date().toISOString(),
    },
  });

  setTimeout(() => supabase.removeChannel(channel), 250);
}

export function subscribeAppBroadcast(
  event: string,
  handler: (payload: any) => void,
) {
  const supabase = getSupabaseBrowserClient();

  const channel = supabase
    .channel(APP_LIVE_CHANNEL, {
      config: { broadcast: { self: true } },
    })
    .on('broadcast', { event }, ({ payload }) => {
      handler(payload);
    })
    .subscribe((status) => {
      console.log(`[app-live] ${event}:`, status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export function broadcastDashboardMessage(message: DashboardMessageBroadcastPayload) {
  return sendAppBroadcast('dashboard-message-updated', { message });
}

export function broadcastWinnerAnnouncement(announcement: WinnerAnnouncementBroadcastPayload) {
  return sendAppBroadcast('winner-announcement-updated', { announcement });
}
