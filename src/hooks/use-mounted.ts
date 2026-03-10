"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => undefined;
}

export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
