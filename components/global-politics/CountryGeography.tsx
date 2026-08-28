"use client";

import { memo } from "react";
import { Geography } from "react-simple-maps";
import {
  countryFillColor,
  countryStrokeColor,
} from "@/lib/geopolitics/analyze";
import { MAP_LAYER_TRANSITION } from "@/lib/geopolitics/map-viewport";
import type { CountryGeopoliticsMetrics } from "@/lib/geopolitics/types";

type CountryGeographyProps = {
  geo: {
    rsmKey: string;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  };
  iso2: string;
  metrics: CountryGeopoliticsMetrics | undefined;
  selectedIso2: string | null;
  hoveredIso2: string | null;
  layerOpacity: number;
  onSelect: (iso2: string) => void;
  onHover: (iso2: string | null) => void;
};

export const CountryGeography = memo(function CountryGeography({
  geo,
  iso2,
  metrics,
  selectedIso2,
  hoveredIso2,
  layerOpacity,
  onSelect,
  onHover,
}: CountryGeographyProps) {
  const isSelected = selectedIso2 === iso2;
  const isHovered = hoveredIso2 === iso2;
  const stroke = countryStrokeColor(iso2, selectedIso2, hoveredIso2);
  const strokeWidth = isSelected ? 1.4 : isHovered ? 1.1 : 0.35;
  const opacity = isSelected || isHovered ? Math.min(1, layerOpacity + 0.25) : layerOpacity;

  return (
    <Geography
      geography={geo}
      onMouseEnter={() => onHover(iso2)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(iso2)}
      style={{
        default: {
          fill: countryFillColor(metrics),
          stroke,
          strokeWidth,
          opacity,
          outline: "none",
          cursor: "pointer",
          vectorEffect: "non-scaling-stroke",
          transition: MAP_LAYER_TRANSITION,
        },
        hover: {
          fill: countryFillColor(metrics),
          stroke: isHovered ? "#3b82f6" : stroke,
          strokeWidth: isHovered ? 1.1 : strokeWidth,
          opacity: Math.min(1, opacity + 0.15),
          outline: "none",
          cursor: "pointer",
          vectorEffect: "non-scaling-stroke",
          transition: MAP_LAYER_TRANSITION,
        },
        pressed: {
          fill: countryFillColor(metrics),
          stroke: "#eab308",
          strokeWidth: 1.2,
          opacity: 1,
          outline: "none",
          vectorEffect: "non-scaling-stroke",
          transition: MAP_LAYER_TRANSITION,
        },
      }}
    />
  );
});

CountryGeography.displayName = "CountryGeography";
