"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribe = (changed: () => void) => {
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
  };
};

export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** `online` follows the browser; `backOnline` is true for a few seconds after reconnecting. */
export function useConnection() {
  const online = useSyncExternalStore(
    subscribe,
    () => !isOffline(),
    () => true,
  );
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const up = () => {
      setBackOnline(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBackOnline(false), 5000);
    };
    const down = () => setBackOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return { online, backOnline };
}
