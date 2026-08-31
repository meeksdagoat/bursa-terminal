"use client";

import { StrategyBuilderModal } from "@/components/quant/StrategyBuilderModal";
import type { CustomStrategy } from "@/lib/quant/custom-strategy";

type CustomStrategyModalProps = {
  open: boolean;
  strategyId: string | null;
  strategySnapshot: CustomStrategy | null;
  onClose: () => void;
  onSave: (strategy: CustomStrategy) => void;
  onDelete: (id: string) => void;
};

/** Edit-focused wrapper — hydrates from an immutable snapshot captured at open time. */
export function CustomStrategyModal({
  open,
  strategyId,
  strategySnapshot,
  onClose,
  onSave,
  onDelete,
}: CustomStrategyModalProps) {
  if (!open || !strategyId || !strategySnapshot) return null;

  const editorSessionKey = `${strategyId}:${strategySnapshot.updatedAt ?? ""}`;

  return (
    <StrategyBuilderModal
      key={editorSessionKey}
      open={open}
      variant="edit"
      initial={{ ...strategySnapshot, id: strategyId }}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
