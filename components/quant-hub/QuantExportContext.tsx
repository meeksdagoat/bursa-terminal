"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ExportToolbar } from "@/components/quant-hub/ExportToolbar";
import type { ExportPayload } from "@/utils/exportData";

type PayloadGetter = () => ExportPayload | Promise<ExportPayload>;

type QuantExportActions = {
  register: (getter: PayloadGetter, disabled: boolean) => void;
  unregister: () => void;
};

type QuantExportState = {
  getter: PayloadGetter | null;
  disabled: boolean;
};

const QuantExportActionsContext = createContext<QuantExportActions | null>(null);
const QuantExportStateContext = createContext<QuantExportState>({
  getter: null,
  disabled: true,
});

export function QuantExportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuantExportState>({ getter: null, disabled: true });

  const register = useCallback((nextGetter: PayloadGetter, nextDisabled: boolean) => {
    setState({ getter: nextGetter, disabled: nextDisabled });
  }, []);

  const unregister = useCallback(() => {
    setState({ getter: null, disabled: true });
  }, []);

  const actions = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <QuantExportActionsContext.Provider value={actions}>
      <QuantExportStateContext.Provider value={state}>{children}</QuantExportStateContext.Provider>
    </QuantExportActionsContext.Provider>
  );
}

export function useRegisterQuantExport(getPayload: PayloadGetter, disabled = false) {
  const actions = useContext(QuantExportActionsContext);
  const getterRef = useRef(getPayload);
  getterRef.current = getPayload;

  useEffect(() => {
    if (!actions) return;
    actions.register(() => getterRef.current(), disabled);
  }, [actions, disabled]);

  useEffect(() => {
    if (!actions) return;
    return () => actions.unregister();
  }, [actions]);
}

export function RegisteredExportToolbar() {
  const state = useContext(QuantExportStateContext);
  return (
    <ExportToolbar
      disabled={!state.getter || state.disabled}
      getPayload={
        state.getter ??
        (async () => {
          throw new Error("No data to export");
        })
      }
    />
  );
}
