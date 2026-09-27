import { useSyncExternalStore } from "react";
import {
  getAmbianceEnabled,
  subscribeAmbianceEnabled,
} from "../lib/ambiance-settings.ts";

/** The live ambiance on/off preference, shared across the whole app. */
export function useAmbianceEnabled(): boolean {
  return useSyncExternalStore(
    subscribeAmbianceEnabled,
    getAmbianceEnabled,
    getAmbianceEnabled,
  );
}
