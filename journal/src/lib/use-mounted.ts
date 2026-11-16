"use client";

import { useSyncExternalStore } from "react";

/** True after hydration. Gate anything that depends on the viewer's timezone or clock. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
