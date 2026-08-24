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
  /** Draws a polyline between multiple points (supplier trail + route). */
  route?: [number, number][] | null;
  trail?: [number, number][] | null;
  /** Fires when the user drags the map, so a pin can follow the centre. */
  onCenterChange?: (lat: number, lng: number) => void;
  /** Recentres the map when this value changes. */
  recenterKey?: string;
  interactive?: boolean;
  /** Fit bounds to include both center and all markers. */
  fitBounds?: boolean;
};

function icon(marker: MapMarker) {
  const size = marker.kind === "station" ? 26 : marker.kind === "supplier" ? 38 : 34;
  if (marker.kind === "supplier") {
    return L.divIcon({
      className: "",
      html: `<div class="pin pin--supplier pin--animated"><span class="pin__car">🚗</span></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  const modifier = marker.kind === "pickup" ? "" : " pin--station";
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
  trail = null,
  onCenterChange,
  recenterKey,
  interactive = true,
  fitBounds = false,
}: MapViewProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const trailLine = useRef<L.Polyline | null>(null);
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
    window.setTimeout(() => instance.invalidateSize(), 120);

    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
      routeLine.current = null;
      trailLine.current = null;
    };
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
        zIndexOffset: marker.kind === "supplier" ? 1000 : 0,
      });
      if (marker.onClick) pin.on("click", marker.onClick);
      if (marker.label) pin.bindTooltip(marker.label, { direction: "top", offset: [0, -20] });
      pin.addTo(layer.current);
    }
  }, [markers]);

  useEffect(() => {
    if (!map.current) return;
    routeLine.current?.remove();
    routeLine.current = null;
    if (!route || route.length < 2) return;
    routeLine.current = L.polyline(route, {
      color: "var(--accent-text, #e74c3c)",
      weight: 4,
      opacity: 0.9,
      lineCap: "round",
    }).addTo(map.current);
  }, [route]);

  useEffect(() => {
    if (!map.current) return;
    trailLine.current?.remove();
    trailLine.current = null;
    if (!trail || trail.length < 2) return;
    trailLine.current = L.polyline(trail, {
      color: "var(--accent-text, #e74c3c)",
      weight: 3,
      opacity: 0.4,
      dashArray: "6 10",
      lineCap: "round",
    }).addTo(map.current);
  }, [trail]);

  useEffect(() => {
    if (!map.current || !fitBounds) return;
    const allPoints: L.LatLngExpression[] = markers.map((m) => [m.lat, m.lng]);
    if (allPoints.length >= 2) {
      map.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: 15 });
    }
  }, [fitBounds, markers]);

  return <div ref={holder} className="map" aria-label="Map" />;
}
