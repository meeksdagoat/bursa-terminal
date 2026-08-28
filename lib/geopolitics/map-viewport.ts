import { geoDistance, geoEqualEarth } from "d3-geo";

export const MAP_PROJECTION_CENTER: [number, number] = [10, 5];
export const MAP_PROJECTION_SCALE = 155;

export const LABEL_ZOOM_MIN = 2;
export const LABEL_ZOOM_MAX = 3.5;
export const LABEL_FONT_PX = 10;
export const COUNTRY_FOCUS_ZOOM = 3.8;

export type MapViewState = {
  zoom: number;
  panX: number;
  panY: number;
  focusCoordinates: [number, number];
};

export const DEFAULT_MAP_VIEW: MapViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  focusCoordinates: MAP_PROJECTION_CENTER,
};

export function createMapProjection(width = 800, height = 600) {
  return geoEqualEarth()
    .translate([width / 2, height / 2])
    .scale(MAP_PROJECTION_SCALE)
    .center(MAP_PROJECTION_CENTER);
}

/** Geographic point currently under the viewport center for the active pan/zoom transform. */
export function viewportFocusCoordinates(
  width: number,
  height: number,
  panX: number,
  panY: number,
  zoom: number,
): [number, number] {
  if (width <= 0 || height <= 0 || zoom <= 0) return MAP_PROJECTION_CENTER;

  const projection = createMapProjection(width, height);
  const projX = (width / 2 - panX) / zoom;
  const projY = (height / 2 - panY) / zoom;
  const inverted = projection.invert?.([projX, projY]);
  return inverted ?? MAP_PROJECTION_CENTER;
}

/** Radial falloff for countries/markers based on great-circle distance from focus. */
export function focusLayerOpacity(
  focus: [number, number],
  target: [number, number] | null,
  zoom: number,
): number {
  if (!target) return 1;

  const distance = geoDistance(focus, target);
  const maxRadius = Math.max(0.35, Math.PI / (2.2 + zoom * 1.35));
  return Math.max(0.25, 1 - distance / maxRadius);
}

/** Progressive label fade: hidden <2x, linear 2–3.5x, full >3.5x. */
export function labelZoomOpacity(zoom: number): number {
  if (zoom < LABEL_ZOOM_MIN) return 0;
  if (zoom >= LABEL_ZOOM_MAX) return 1;
  return (zoom - LABEL_ZOOM_MIN) / (LABEL_ZOOM_MAX - LABEL_ZOOM_MIN);
}

export function countryLabelOpacity(
  zoom: number,
  focus: [number, number],
  centroid: [number, number] | null,
): number {
  const zoomOpacity = labelZoomOpacity(zoom);
  if (zoomOpacity <= 0 || !centroid) return 0;

  const focusFactor = focusLayerOpacity(focus, centroid, zoom);
  if (focusFactor < 0.45) return 0;
  if (focusFactor >= 0.85) return zoomOpacity;

  const t = (focusFactor - 0.45) / 0.4;
  return zoomOpacity * Math.min(1, Math.max(0, t));
}

export const MAP_LAYER_TRANSITION = "opacity 250ms ease-in-out, fill 200ms ease";
