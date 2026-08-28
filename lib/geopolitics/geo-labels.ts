import { geoArea, geoCentroid } from "d3-geo";
import type { MapViewState } from "./map-viewport";

/** Prefer the centroid of the largest polygon ring (stable for MultiPolygon countries). */
export function labelPointForFeature(geo: Record<string, unknown>): [number, number] | null {
  const geometry = geo.geometry as
    | {
        type?: string;
        coordinates?: unknown;
      }
    | undefined;
  if (!geometry) return null;

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    let bestArea = -1;
    let bestPoint: [number, number] | null = null;

    for (const polygon of geometry.coordinates as number[][][][]) {
      const feature = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: polygon },
      };
      const area = geoArea(feature);
      if (area <= bestArea) continue;
      const centroid = geoCentroid(feature);
      if (Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
        bestArea = area;
        bestPoint = centroid as [number, number];
      }
    }

    if (bestPoint) return bestPoint;
  }

  try {
    const centroid = geoCentroid(geo as never) as [number, number];
    if (Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) return centroid;
  } catch {
    return null;
  }

  return null;
}

/** Screen-space visibility for a projected centroid under the active zoom transform. */
export function isProjectedPointInViewport(
  projected: [number, number] | null | undefined,
  mapWidth: number,
  mapHeight: number,
  viewState: Pick<MapViewState, "panX" | "panY" | "zoom">,
  padding = 28,
): boolean {
  if (!projected) return false;
  const [px, py] = projected;
  const screenX = px * viewState.zoom + viewState.panX;
  const screenY = py * viewState.zoom + viewState.panY;

  return (
    screenX >= -padding &&
    screenX <= mapWidth + padding &&
    screenY >= -padding &&
    screenY <= mapHeight + padding
  );
}

/** Counter-scale label font size so text stays ~constant px during zoom. */
export function counterScaledLabelFontSize(basePx: number, zoom: number): number {
  return basePx / Math.max(zoom, 0.001);
}
