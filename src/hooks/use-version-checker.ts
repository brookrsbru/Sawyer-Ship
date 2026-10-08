import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface VersionCheckerState {
  currentVersion: string;
  latestVersion: string | null;
  isOutdated: boolean;
  isDismissed: boolean;
  dismissBanner: () => void;
  checkNow: () => Promise<void>;
  lastChecked: Date | null;
}

export function useVersionChecker(): VersionCheckerState {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isOutdated, setIsOutdated] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const isMountedRef = useRef(true);

  const checkVersion = useCallback(async () => {
    try {
      // Append timestamp query parameter to prevent browser or CDN caching
      const response = await fetch(`${GITHUB_CONSTANTS_RAW_URL}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Accept': 'text/plain',
        },
      });

      if (!response.ok) {
        console.warn(`[VersionChecker] Failed to fetch constants.ts from GitHub (Status: ${response.status})`);
        return;
      }

      const text = await response.text();
      // Match `export const APP_VERSION = '2.10.4';` or similar
      const match = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);

      if (match && match[1]) {
        const fetchedVersion = match[1].trim();
        if (isMountedRef.current) {
          setLatestVersion(fetchedVersion);
          setLastChecked(new Date());

          if (isRemoteNewer(fetchedVersion, APP_VERSION)) {
            setIsOutdated(true);
          } else {
            setIsOutdated(false);
          }
        }
      }
    } catch (err) {
      console.warn('[VersionChecker] Error checking latest version:', err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Check immediately on mount
    checkVersion();

    // Check every 5 minutes
    const intervalId = setInterval(() => {
      checkVersion();
    }, CHECK_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [checkVersion]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    currentVersion: APP_VERSION,
    latestVersion,
    isOutdated,
    isDismissed,
    dismissBanner,
    checkNow: checkVersion,
    lastChecked,
  };
}
