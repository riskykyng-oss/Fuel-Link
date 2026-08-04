import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "pickup" | "supplier" | "station";
  glyph: string;
  label?: string;
  onClick?: () => void;
};

type MapViewProps = {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  /** Draws a dashed line between two points, e.g. supplier to pickup. */
  route?: [[number, number], [number, number]] | null;
  /** Fires when the user drags the map, so a pin can follow the centre. */
  onCenterChange?: (lat: number, lng: number) => void;
  /** Recentres the map when this value changes. */
  recenterKey?: string;
  interactive?: boolean;
};

function icon(marker: MapMarker) {
  const modifier =
    marker.kind === "supplier" ? " pin--supplier" : marker.kind === "station" ? " pin--station" : "";
  const size = marker.kind === "station" ? 26 : 34;
  return L.divIcon({
    className: "",
    html: `<div class="pin${modifier}">${marker.glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function MapView({
  center,
  zoom = 14,
  markers = [],
  route = null,
  onCenterChange,
  recenterKey,
  interactive = true,
}: MapViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const moveHandler = useRef(onCenterChange);
  moveHandler.current = onCenterChange;

  useEffect(() => {
    if (!holder.current || map.current) return;

    const instance = L.map(holder.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(instance);

    layer.current = L.layerGroup().addTo(instance);
    instance.on("moveend", () => {
      const c = instance.getCenter();
      moveHandler.current?.(c.lat, c.lng);
    });

    map.current = instance;
    // Leaflet mis-measures inside sheets that animate in; settle after paint.
    window.setTimeout(() => instance.invalidateSize(), 120);

    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
      line.current = null;
    };
    // Mount-only: subsequent prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !recenterKey) return;
    map.current.setView(center, map.current.getZoom(), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    for (const marker of markers) {
      const pin = L.marker([marker.lat, marker.lng], {
        icon: icon(marker),
        keyboard: false,
        title: marker.label,
      });
      if (marker.onClick) pin.on("click", marker.onClick);
      if (marker.label) pin.bindTooltip(marker.label, { direction: "top", offset: [0, -18] });
      pin.addTo(layer.current);
    }
  }, [markers]);

  useEffect(() => {
    if (!map.current) return;
    line.current?.remove();
    line.current = null;
    if (!route) return;
    line.current = L.polyline(route, {
      color: "#e0ff4f",
      weight: 3,
      opacity: 0.85,
      dashArray: "1 9",
      lineCap: "round",
    }).addTo(map.current);
  }, [route]);

  return <div ref={holder} className="map" aria-label="Map" />;
}
