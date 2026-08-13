import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

function AircraftMarker() {
  return (
    <div className="aircraft-marker" aria-label="Aircraft position">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M32 5 L37 27 L55 36 L55 41 L37 36 L35 57 L29 57 L27 36 L9 41 L9 36 L27 27 Z"
          fill="#ffd83d"
          stroke="#080b0f"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const fileInputRef = useRef(null);
  const [airspace, setAirspace] = useState(EMPTY_COLLECTION);
  const [status, setStatus] = useState("No airspace dataset loaded");

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      },
      center: [-1.5, 54.5],
      zoom: 5.2
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("airspace", { type: "geojson", data: EMPTY_COLLECTION });

      map.addLayer({
        id: "airspace-fill",
        type: "fill",
        source: "airspace",
        paint: { "fill-color": "#64748b", "fill-opacity": 0.16 }
      });

      map.addLayer({
        id: "airspace-outline",
        type: "line",
        source: "airspace",
        paint: {
          "line-color": "#111827",
          "line-width": 1.5,
          "line-opacity": 0.9
        }
      });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.getSource("airspace")?.setData(airspace);
  }, [airspace]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
        throw new Error("The file is not a GeoJSON FeatureCollection.");
      }

      setAirspace(parsed);
      setStatus(`${parsed.features.length.toLocaleString()} feature${parsed.features.length === 1 ? "" : "s"} loaded from ${file.name}`);

      const map = mapRef.current;
      if (!map || !parsed.features.length) return;

      const bounds = new maplibregl.LngLatBounds();
      let found = false;

      function addCoords(coords) {
        if (!Array.isArray(coords)) return;
        if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
          bounds.extend(coords);
          found = true;
          return;
        }
        coords.forEach(addCoords);
      }

      parsed.features.forEach((feature) => addCoords(feature.geometry?.coordinates));
      if (found) map.fitBounds(bounds, { padding: 70, maxZoom: 11, duration: 700 });
    } catch (error) {
      setStatus(`Could not load file: ${error.message}`);
    }
  }

  const openPicker = () => fileInputRef.current?.click();

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><AircraftMarker /></div>
          <div>
            <div className="brand-name">SmartyMap</div>
            <div className="brand-subtitle">Flight simulation moving map</div>
          </div>
        </div>

        <button className="import-button" onClick={openPicker}>Import airspace</button>
        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          onChange={handleFile}
        />
      </header>

      <section className="map-shell">
        <div ref={mapContainer} className="map" />

        <aside className="status-panel">
          <div className="status-title">Airspace data</div>
          <div className="status-text">{status}</div>
          <button className="panel-button" onClick={openPicker}>Choose GeoJSON</button>
          <div className="status-note">
            SmartyMap does not bundle aviation airspace data. Import a dataset that you are entitled to use.
          </div>
        </aside>

        <div className="aircraft-placeholder"><AircraftMarker /></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
