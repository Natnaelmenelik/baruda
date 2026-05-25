"use client";

export const APP_REALTIME_EVENTS = {
  numbersUpdated: "numbers-updated",
  settingsUpdated: "settings-updated",
  winnerAnnouncementUpdated: "winner-announcement-refresh",
  dashboardMessageUpdated: "dashboard-message-refresh",
} as const;

export function emitNumbersUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APP_REALTIME_EVENTS.numbersUpdated));
  }
}

export function emitSettingsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APP_REALTIME_EVENTS.settingsUpdated));
  }
}

export function emitWinnerAnnouncementUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APP_REALTIME_EVENTS.winnerAnnouncementUpdated));
  }
}

export function emitDashboardMessageUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APP_REALTIME_EVENTS.dashboardMessageUpdated));
  }
}
