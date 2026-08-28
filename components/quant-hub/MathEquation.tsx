"use client";

import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";

type MathEquationProps = {
  latex: string;
  display?: boolean;
  className?: string;
};

export function MathEquation({ latex, display = true, className = "" }: MathEquationProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
        trust: false,
      });
    } catch {
      return latex;
    }
  }, [display, latex]);

  return (
    <div
      className={`quant-katex flex justify-center overflow-x-auto py-3 [&_.katex]:text-amber-400 [&_.katex-display]:m-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
