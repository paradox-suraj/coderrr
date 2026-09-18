/**
 * Multi-Tab Coordination & Quarantine Storage
 *
 * Coordinates schema migrations, version transitions, and emergency quarantine
 * across multiple open browser tabs using BroadcastChannel and CustomEvents.
 */

const CHANNEL_NAME = 'algojeet_tab_channel';
let channel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'DB_VERSION_CHANGE') {
        console.warn('[BroadcastChannel] Database version change detected from another tab.');
        window.dispatchEvent(new CustomEvent('algojeet:tab-versionchange', { detail: payload }));
      } else if (type === 'DB_UPGRADE_QUARANTINE') {
        console.error('[BroadcastChannel] Database upgrade quarantine triggered in another tab.');
        window.dispatchEvent(new CustomEvent('algojeet:tab-quarantine', { detail: payload }));
      }
    };
  } catch (err) {
    console.warn('[BroadcastChannel] Could not initialize tab channel:', err);
  }
}

export function broadcastTabMessage(type: string, payload?: any): void {
  try {
    channel?.postMessage({ type, payload, timestamp: Date.now() });
  } catch {
    // Ignore channel post errors in constrained environments
  }
}

/**
 * Emergency Quarantine:
 * When an UpgradeError occurs, extract all reachable data into localStorage
 * and never delete the existing database.
 */
export async function emergencyQuarantine(error: any): Promise<string> {
  const timestamp = Date.now();
  const quarantineKey = `algojeet_quarantine_${timestamp}`;
  const notice = {
    errorName: error?.name || 'UnknownError',
    errorMessage: error?.message || String(error),
    timestamp: new Date().toISOString(),
  };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(quarantineKey, JSON.stringify(notice));
    }
  } catch (storageErr) {
    console.warn('[quarantine] Could not write to localStorage:', storageErr);
  }

  broadcastTabMessage('DB_UPGRADE_QUARANTINE', { quarantineKey, notice });
  return quarantineKey;
}
