declare module "react-simple-maps" {
  import type { CSSProperties, ReactNode, SVGProps } from "react";

  export type GeographyFeature = {
    rsmKey: string;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  };

  export type ComposableMapProps = {
    projection?: string;
    projectionConfig?: Record<string, number | [number, number]>;
    width?: number;
    height?: number;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  };

  export type GeographyProps = {
    geography: GeographyFeature;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onClick?: () => void;
    style?: {
      default?: SVGProps<SVGPathElement> & {
        outline?: string;
        transition?: string;
        vectorEffect?: "non-scaling-stroke" | "none" | "non-scaling-size" | string;
      };
      hover?: SVGProps<SVGPathElement> & {
        outline?: string;
        transition?: string;
        vectorEffect?: "non-scaling-stroke" | "none" | "non-scaling-size" | string;
      };
      pressed?: SVGProps<SVGPathElement> & {
        outline?: string;
        transition?: string;
        vectorEffect?: "non-scaling-stroke" | "none" | "non-scaling-size" | string;
      };
    };
  };

  export type GeographiesProps = {
    geography: string | object;
    children: (args: {
      geographies: GeographyFeature[];
      outline?: unknown;
      borders?: unknown;
      path?: unknown;
      projection?: (coordinates: [number, number]) => [number, number] | null;
    }) => ReactNode;
  };

  export type ZoomableGroupProps = {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    filterZoomEvent?: (event: unknown) => boolean;
    onMoveStart?: (position: { coordinates: [number, number]; zoom: number }) => void;
    onMove?: (position: { x: number; y: number; zoom: number }, event?: unknown) => void;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }, event?: unknown) => void;
    children?: ReactNode;
  };

  export type MarkerProps = {
    coordinates: [number, number];
    children?: ReactNode;
  };

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
}
