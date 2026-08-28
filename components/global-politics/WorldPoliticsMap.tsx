"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { CountryGeography } from "@/components/global-politics/CountryGeography";
import { CountrySearchCombobox } from "@/components/global-politics/CountrySearchCombobox";
import {
  activityStatusLabel,
  countryMetricsForIso2,
} from "@/lib/geopolitics/analyze";
import { countryByIso2 } from "@/lib/geopolitics/countries";
import {
  counterScaledLabelFontSize,
  isProjectedPointInViewport,
  labelPointForFeature,
} from "@/lib/geopolitics/geo-labels";
import {
  countryLabelOpacity,
  COUNTRY_FOCUS_ZOOM,
  DEFAULT_MAP_VIEW,
  focusLayerOpacity,
  LABEL_FONT_PX,
  MAP_LAYER_TRANSITION,
  MAP_PROJECTION_CENTER,
  type MapViewState,
  viewportFocusCoordinates,
} from "@/lib/geopolitics/map-viewport";
import { resolveTopoCountry } from "@/lib/geopolitics/world-registry";
import type { GeopoliticsMapModel } from "@/lib/geopolitics/types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type WorldPoliticsMapProps = {
  model: GeopoliticsMapModel;
  selectedIso2: string | null;
  hoveredIso2: string | null;
  onSelectCountry: (iso2: string | null) => void;
  onHoverCountry: (iso2: string | null) => void;
  isCoarsePointer?: boolean;
};

type ParsedGeo = {
  geo: {
    rsmKey: string;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  };
  iso2: string;
  name: string;
  labelPoint: [number, number] | null;
};

type ZoomPanMove = {
  x: number;
  y: number;
  zoom: number;
};

type GeoProjection = ((coordinates: [number, number]) => [number, number] | null) | undefined;

function hotspotIcon(eventType: GeopoliticsMapModel["hotspots"][number]["eventType"]): string {
  switch (eventType) {
    case "conflict":
      return "⚔️";
    case "disaster":
      return "🌪️";
    case "election":
      return "⚖️";
    default:
      return "📍";
  }
}

function parseGeographies(
  rows: Array<{
    rsmKey: string;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  }>,
): ParsedGeo[] {
  return rows
    .map((geo) => {
      const resolved = resolveTopoCountry(geo.properties);
      if (!resolved) return null;
      return {
        geo,
        iso2: resolved.iso2,
        name: resolved.name,
        labelPoint: labelPointForFeature(geo),
      };
    })
    .filter((row): row is ParsedGeo => row != null);
}

export function WorldPoliticsMap({
  model,
  selectedIso2,
  hoveredIso2,
  onSelectCountry,
  onHoverCountry,
  isCoarsePointer = false,
}: WorldPoliticsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const centroidByIso2Ref = useRef<Record<string, [number, number]>>({});
  const [mapSize, setMapSize] = useState({ width: 800, height: 480 });
  const [mapCenter, setMapCenter] = useState<[number, number]>(MAP_PROJECTION_CENTER);
  const [mapZoom, setMapZoom] = useState(1);
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_MAP_VIEW);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setMapSize({ width: Math.round(width), height: Math.round(height) });
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleMove = useCallback(
    (position: ZoomPanMove) => {
      setViewState({
        zoom: position.zoom,
        panX: position.x,
        panY: position.y,
        focusCoordinates: viewportFocusCoordinates(
          mapSize.width,
          mapSize.height,
          position.x,
          position.y,
          position.zoom,
        ),
      });
    },
    [mapSize.height, mapSize.width],
  );

  const handleMoveEnd = useCallback(
    (
      position: { coordinates: [number, number]; zoom: number },
      event?: { transform?: { x: number; y: number; k: number } },
    ) => {
      const panX = event?.transform?.x ?? 0;
      const panY = event?.transform?.y ?? 0;
      setMapCenter(position.coordinates);
      setMapZoom(position.zoom);
      setViewState({
        zoom: position.zoom,
        panX,
        panY,
        focusCoordinates: viewportFocusCoordinates(
          mapSize.width,
          mapSize.height,
          panX,
          panY,
          position.zoom,
        ),
      });
    },
    [mapSize.height, mapSize.width],
  );

  const focusOnCountry = useCallback(
    (iso2: string) => {
      const centroid =
        centroidByIso2Ref.current[iso2] ??
        countryByIso2(iso2)?.coordinates ??
        countryMetricsForIso2(model, iso2).coordinates;

      setMapCenter(centroid);
      setMapZoom(COUNTRY_FOCUS_ZOOM);
      setViewState({
        zoom: COUNTRY_FOCUS_ZOOM,
        panX: 0,
        panY: 0,
        focusCoordinates: centroid,
      });
      onSelectCountry(iso2);
      onHoverCountry(iso2);
    },
    [model, onHoverCountry, onSelectCountry],
  );

  const handleSelect = useCallback(
    (iso2: string) => {
      onSelectCountry(selectedIso2 === iso2 ? null : iso2);
      if (isCoarsePointer) onHoverCountry(iso2);
    },
    [isCoarsePointer, onHoverCountry, onSelectCountry, selectedIso2],
  );

  const hoveredMetrics = hoveredIso2
    ? countryMetricsForIso2(model, hoveredIso2)
    : undefined;

  const focus = viewState.focusCoordinates;
  const labelFontSize = useMemo(
    () => counterScaledLabelFontSize(LABEL_FONT_PX, viewState.zoom),
    [viewState.zoom],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[320px] w-full touch-pan-x touch-pan-y overflow-hidden rounded border border-neutral-800 bg-[#0a0a0a]"
      style={{ touchAction: "pan-x pan-y" }}
    >
      <ComposableMap
        width={mapSize.width}
        height={mapSize.height}
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155, center: MAP_PROJECTION_CENTER }}
        className="h-full w-full"
        style={{ width: "100%", height: "100%", backgroundColor: "#0a0a0a" }}
      >
        <ZoomableGroup
          center={mapCenter}
          zoom={mapZoom}
          minZoom={0.85}
          maxZoom={8}
          onMove={(position) => handleMove(position as ZoomPanMove)}
          onMoveEnd={(position, event) =>
            handleMoveEnd(position, event as { transform?: { x: number; y: number; k: number } })
          }
        >
          <Geographies geography={GEO_URL}>
            {({ geographies: rows, projection }) => {
              const parsed = parseGeographies(rows);
              const project = projection as GeoProjection;

              for (const row of parsed) {
                if (row.labelPoint) centroidByIso2Ref.current[row.iso2] = row.labelPoint;
              }

              return (
                <>
                  {parsed.map(({ geo, iso2, labelPoint }) => (
                    <CountryGeography
                      key={geo.rsmKey}
                      geo={geo}
                      iso2={iso2}
                      metrics={model.byIso2[iso2]}
                      selectedIso2={selectedIso2}
                      hoveredIso2={hoveredIso2}
                      layerOpacity={focusLayerOpacity(focus, labelPoint, viewState.zoom)}
                      onSelect={handleSelect}
                      onHover={onHoverCountry}
                    />
                  ))}

                  <g className="pointer-events-none" aria-hidden>
                    {parsed.map(({ geo, iso2, name, labelPoint }) => {
                      if (!labelPoint || !project) return null;

                      const projected = project(labelPoint);
                      if (!projected) return null;

                      if (
                        !isProjectedPointInViewport(
                          projected,
                          mapSize.width,
                          mapSize.height,
                          viewState,
                        )
                      ) {
                        return null;
                      }

                      const opacity = countryLabelOpacity(viewState.zoom, focus, labelPoint);
                      if (opacity <= 0.01) return null;

                      const [x, y] = projected;
                      const label = name.length > 16 ? iso2 : name;

                      return (
                        <text
                          key={`label-${geo.rsmKey}`}
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={labelFontSize}
                          opacity={opacity}
                          pointerEvents="none"
                          className="pointer-events-none fill-zinc-200/90 font-mono font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                          style={{ transition: MAP_LAYER_TRANSITION }}
                        >
                          {label}
                        </text>
                      );
                    })}
                  </g>
                </>
              );
            }}
          </Geographies>

          {model.hotspots.map((hotspot) => {
            const markerOpacity = focusLayerOpacity(focus, hotspot.coordinates, viewState.zoom);
            if (markerOpacity < 0.2) return null;

            return (
              <Marker key={hotspot.iso2} coordinates={hotspot.coordinates}>
                <g
                  opacity={Math.min(1, markerOpacity + 0.15)}
                  style={{ transition: MAP_LAYER_TRANSITION }}
                  transform="translate(-12, -20)"
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectCountry(selectedIso2 === hotspot.iso2 ? null : hotspot.iso2);
                  }}
                >
                  <rect x={0} y={0} width={24} height={24} fill="transparent" aria-hidden />
                  {hotspot.priority === "high" ? (
                    <circle
                      cx={12}
                      cy={12}
                      r={12}
                      fill="#ef4444"
                      fillOpacity={0.25}
                      className="animate-ping"
                    />
                  ) : null}
                  <circle cx={12} cy={12} r={6} fill="#0a0a0a" stroke="#ef4444" strokeWidth={1} />
                  <text x={12} y={15} textAnchor="middle" fontSize={9}>
                    {hotspotIcon(hotspot.eventType)}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      <CountrySearchCombobox
        model={model}
        selectedIso2={selectedIso2}
        onSelectCountry={focusOnCountry}
      />

      {hoveredMetrics ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[280px] rounded border border-neutral-800 bg-[#121212]/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <p className="text-[11px] font-semibold text-white">{hoveredMetrics.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-amber-400">
            {activityStatusLabel(hoveredMetrics)}
          </p>
          {!isCoarsePointer ? (
            <p className="mt-1 font-mono text-[9px] text-neutral-500">Click to open news stream</p>
          ) : null}
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[280px] rounded border border-neutral-800 bg-[#121212]/90 px-3 py-2">
          <p className="font-mono text-[9px] text-neutral-500">
            {isCoarsePointer
              ? "Tap any country · Pinch to zoom · Drag to pan"
              : "Scroll over a region to zoom · Drag to pan"}
          </p>
        </div>
      )}
    </div>
  );
}

export const MemoWorldPoliticsMap = memo(WorldPoliticsMap);
