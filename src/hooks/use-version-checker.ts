import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '@/src/constants';

const GITHUB_CONSTANTS_RAW_URL = 'https://raw.githubusercontent.com/brookrsbru/Sawyer-Ship/main/src/constants.ts';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parses semver or version string like "2.10.4" into numeric array [2, 10, 4]
 */
function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map(part => parseInt(part, 10) || 0);
}

/**
 * Returns true if remoteVersion is strictly newer than currentVersion
 */
export function isRemoteNewer(remoteVersion: string, currentVersion: string): boolean {
  const remoteParts = parseVersion(remoteVersion);
  const currentParts = parseVersion(currentVersion);

  const len = Math.max(remoteParts.length, currentParts.length);
  for (let i = 0; i < len; i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export interface CheckResult {
  currentVersion: string;
  latestVersion: string | null;
  isOutdated: boolean;
  error?: string;
}

export interface VersionCheckerState {
  currentVersion: string;
  latestVersion: string | null;
  isOutdated: boolean;
  isDismissed: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
  dismissBanner: () => void;
  resetDismissal: () => void;
  checkNow: () => Promise<CheckResult>;
}

// Module-level singleton store so all hook consumers stay completely synced
let storeState = {
  latestVersion: null as string | null,
  isOutdated: false,
  isDismissed: false,
  isChecking: false,
  lastChecked: null as Date | null,
  error: null as string | null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

let activeCheckPromise: Promise<CheckResult> | null = null;
let globalIntervalStarted = false;

export async function checkLatestVersion(): Promise<CheckResult> {
  if (activeCheckPromise) {
    return activeCheckPromise;
  }

  storeState.isChecking = true;
  storeState.error = null;
  notifyListeners();

  activeCheckPromise = (async () => {
    try {
      // Append timestamp query parameter to bypass CDN/browser caches
      const response = await fetch(`${GITHUB_CONSTANTS_RAW_URL}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Accept': 'text/plain',
        },
      });

      if (!response.ok) {
        const err = `Failed to fetch from GitHub (HTTP ${response.status})`;
        console.warn(`[VersionChecker] ${err}`);
        storeState.isChecking = false;
        storeState.error = err;
        storeState.lastChecked = new Date();
        notifyListeners();
        return {
          currentVersion: APP_VERSION,
          latestVersion: storeState.latestVersion,
          isOutdated: storeState.isOutdated,
          error: err,
        };
      }

      const text = await response.text();
      // Match `export const APP_VERSION = '2.12.2';`
      const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);

      if (match && match[1]) {
        const fetchedVersion = match[1].trim();
        const outdated = isRemoteNewer(fetchedVersion, APP_VERSION);

        storeState.latestVersion = fetchedVersion;
        storeState.isOutdated = outdated;
        storeState.isChecking = false;
        storeState.lastChecked = new Date();
        storeState.error = null;
        if (outdated) {
          // Un-dismiss if a new outdated status is verified so user sees alert
          storeState.isDismissed = false;
        }
        notifyListeners();

        return {
          currentVersion: APP_VERSION,
          latestVersion: fetchedVersion,
          isOutdated: outdated,
        };
      } else {
        const err = 'Could not parse APP_VERSION in repository constants.ts';
        storeState.isChecking = false;
        storeState.error = err;
        storeState.lastChecked = new Date();
        notifyListeners();
        return {
          currentVersion: APP_VERSION,
          latestVersion: storeState.latestVersion,
          isOutdated: storeState.isOutdated,
          error: err,
        };
      }
    } catch (err: any) {
      const errMessage = err?.message || 'Network error checking version';
      console.warn('[VersionChecker] Error checking latest version:', err);
      storeState.isChecking = false;
      storeState.error = errMessage;
      storeState.lastChecked = new Date();
      notifyListeners();
      return {
        currentVersion: APP_VERSION,
        latestVersion: storeState.latestVersion,
        isOutdated: storeState.isOutdated,
        error: errMessage,
      };
    } finally {
      activeCheckPromise = null;
    }
  })();

  return activeCheckPromise;
}

export function useVersionChecker(): VersionCheckerState {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setTick(t => t + 1);
    };
    listeners.add(handleUpdate);

    // Initial check on mount if not checked yet
    if (!storeState.lastChecked && !storeState.isChecking) {
      checkLatestVersion();
    }

    // Start 5-minute interval once globally
    if (!globalIntervalStarted && typeof window !== 'undefined') {
      globalIntervalStarted = true;
      setInterval(() => {
        checkLatestVersion();
      }, CHECK_INTERVAL_MS);
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    storeState.isDismissed = true;
    notifyListeners();
  }, []);

  const resetDismissal = useCallback(() => {
    storeState.isDismissed = false;
    notifyListeners();
  }, []);

  return {
    currentVersion: APP_VERSION,
    latestVersion: storeState.latestVersion,
    isOutdated: storeState.isOutdated,
    isDismissed: storeState.isDismissed,
    isChecking: storeState.isChecking,
    lastChecked: storeState.lastChecked,
    error: storeState.error,
    dismissBanner,
    resetDismissal,
    checkNow: checkLatestVersion,
  };
}
