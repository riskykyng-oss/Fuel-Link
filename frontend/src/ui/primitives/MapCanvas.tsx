import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { MapMarker, PinTone } from "../types";

export interface MapCanvasProps {
  markers: MapMarker[];
  center: [number, number];
  zoom?: number;
  height?: number;
  showControls?: boolean;
}

const pinIcon = (tone: PinTone) =>
  L.divIcon({
    className: "",
    html: `<span class="ui-pin ui-pin--${tone}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

/**
 * Leaflet map with tone-coloured divIcon pins. A numeric `height` guarantees
 * Leaflet gets a real pixel size regardless of flex context; a ResizeObserver
 * calls invalidateSize() after layout so tiles render correctly.
 *
 * NOTE: `center` is a dependency of the init effect — pass a module constant,
 * never an inline array literal (that would rebuild the map on every render).
 */
export function MapCanvas({
  markers,
  center,
  zoom = 13,
  height = 360,
  showControls = true,
}: MapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;

    const map = L.map(host, {
      center,
      zoom,
      zoomControl: showControls,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [center, zoom, showControls]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: pinIcon(m.tone) });
      if (m.label) marker.bindTooltip(m.label, { direction: "top" });
      layer.addLayer(marker);
    });

    if (markers.length > 1) {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng])), {
        padding: [32, 32],
        maxZoom: 15,
      });
    }
  }, [markers]);

  return <div ref={hostRef} className="ui-map" style={{ height }} />;
}
