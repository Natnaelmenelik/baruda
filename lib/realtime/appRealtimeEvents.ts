'use client';

export const APP_REALTIME_EVENTS = {
  numbersUpdated: 'numbers-updated',
  settingsUpdated: 'settings-updated',
  winnerAnnouncementUpdated: 'winner-announcement-refresh',
  dashboardMessageUpdated: 'dashboard-message-refresh',
} as const;

type AppRealtimeEventName =
  (typeof APP_REALTIME_EVENTS)[keyof typeof APP_REALTIME_EVENTS];

const CHANNEL_NAME = 'baruda-app-realtime-events';
let broadcastChannel: BroadcastChannel | null = null;
let broadcastInitialized = false;

function dispatchLocal(type: AppRealtimeEventName, payload?: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(type, { detail: payload }));
}

function getBroadcastChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }

  if (!broadcastInitialized) {
    broadcastInitialized = true;
    broadcastChannel.onmessage = (event) => {
      const type = event?.data?.type as AppRealtimeEventName | undefined;
      if (!type) return;
      dispatchLocal(type, event.data.payload);
    };
  }

  return broadcastChannel;
}

function emit(type: AppRealtimeEventName, payload?: unknown) {
  dispatchLocal(type, payload);

  try {
    getBroadcastChannel()?.postMessage({ type, payload, at: Date.now() });
  } catch {}

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `baruda:${type}`,
        JSON.stringify({ payload, at: Date.now() }),
      );
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  getBroadcastChannel();

  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith('baruda:') || !event.newValue) return;
    const rawType = event.key.replace('baruda:', '') as AppRealtimeEventName;
    if (!Object.values(APP_REALTIME_EVENTS).includes(rawType)) return;

    try {
      const parsed = JSON.parse(event.newValue);
      dispatchLocal(rawType, parsed.payload);
    } catch {
      dispatchLocal(rawType);
    }
  });
}

export function emitNumbersUpdated(payload?: unknown) {
  emit(APP_REALTIME_EVENTS.numbersUpdated, payload);
}

export function emitSettingsUpdated(payload?: unknown) {
  emit(APP_REALTIME_EVENTS.settingsUpdated, payload);
}

export function emitWinnerAnnouncementUpdated(payload?: unknown) {
  emit(APP_REALTIME_EVENTS.winnerAnnouncementUpdated, payload);
}

export function emitDashboardMessageUpdated(payload?: unknown) {
  emit(APP_REALTIME_EVENTS.dashboardMessageUpdated, payload);
}
