import { createContext, useContext, type ReactNode } from "react";

const OpenSettingsContext = createContext<(() => void) | null>(null);

export interface OpenSettingsProviderProps {
  /** Opens the chassis settings drawer — supplied by App.tsx. */
  value: () => void;
  children?: ReactNode;
}

/** Wires the real "open settings" callback from the chassis (App.tsx owns the drawer's open state). */
export function OpenSettingsProvider({ value, children }: OpenSettingsProviderProps) {
  return <OpenSettingsContext.Provider value={value}>{children}</OpenSettingsContext.Provider>;
}

/**
 * Opens the chassis's SettingsDrawer from anywhere in the tree. Screens use this to
 * give empty states a real next action — Sol §5.1's empty-state rule: "explain the
 * condition and present the next valid action" — e.g. TODAY's onboarding card
 * ("set your cycle-start Saturday" -> a button that calls this instead of just prose).
 */
export function useOpenSettings(): () => void {
  const openSettings = useContext(OpenSettingsContext);
  if (!openSettings) {
    throw new Error("useOpenSettings() must be called within <OpenSettingsProvider> (mounted by App.tsx)");
  }
  return openSettings;
}
