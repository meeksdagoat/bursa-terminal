"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useCustomStrategies,
  type CustomStrategiesStore,
} from "@/lib/use-custom-strategies";

const CustomStrategiesContext = createContext<CustomStrategiesStore | null>(null);

export function CustomStrategiesProvider({ children }: { children: ReactNode }) {
  const store = useCustomStrategies();
  return (
    <CustomStrategiesContext.Provider value={store}>{children}</CustomStrategiesContext.Provider>
  );
}

export function useCustomStrategiesContext(): CustomStrategiesStore {
  const context = useContext(CustomStrategiesContext);
  if (!context) {
    throw new Error("useCustomStrategiesContext must be used within CustomStrategiesProvider");
  }
  return context;
}
