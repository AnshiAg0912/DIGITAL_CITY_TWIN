// src/pages/Alerts.js
import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import { Box, Button, Chip, Paper, Typography } from "@mui/material";

// fix default icon (if using webpack/CRA)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const API_URL = "http://localhost:8000/api/flood/forecast";

// Small util: safe formatting like toFixed but won't crash on undefined/null
function safeFixed(val, digits = 0) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return String(val ?? "-");
  return Number(val).toFixed(digits);
}

// Fit map to given points (component using react-leaflet hook)
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (!points || points.length === 0) return;
    const latlngs = points
      .filter((p) => p && p.lat != null && p.lng != null)
      .map((p) => [Number(p.lat), Number(p.lng)]);
    if (latlngs.length === 0) return;
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forecast, setForecast] = useState(null); // will hold {day1, day2, day3}
  const [selectedDay, setSelectedDay] = useState("day1");
  const [mapCenter] = useState([17.385, 78.4867]); // hyderabad center fallback

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server returned ${res.status}: ${txt}`);
      }
      const data = await res.json();
      // data should have keys day1/day2/day3 each with:
      // {severity, rainfall_mm, affected_count, affected_points, message, recommended_actions}
      setForecast(data);
      setSelectedDay("day1");
    } catch (err) {
      console.error("Failed to fetch forecast", err);
      setError(err.message || "Failed to fetch forecast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
    // optional: refresh every 10 minutes
    // const id = setInterval(fetchForecast, 10 * 60 * 1000);
    // return () => clearInterval(id);
  }, []);

  const active = forecast?.[selectedDay] ?? null;
  const points = active?.affected_points ?? [];

  function severityColor(sev) {
    switch (sev) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "moderate":
        return "info";
      default:
        return "success";
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Flood Alerts & Automated Forecast (Hyderabad)
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap" }}>
          <Button
            variant={selectedDay === "day1" ? "contained" : "outlined"}
            onClick={() => setSelectedDay("day1")}
          >
            Next 24h
          </Button>
          <Button
            variant={selectedDay === "day2" ? "contained" : "outlined"}
            onClick={() => setSelectedDay("day2")}
          >
            Next 48h
          </Button>
          <Button
            variant={selectedDay === "day3" ? "contained" : "outlined"}
            onClick={() => setSelectedDay("day3")}
          >
            Next 72h
          </Button>

          <Box sx={{ flex: "1 1 auto" }} />

          <Button onClick={fetchForecast} variant="contained">
            Refresh
          </Button>
        </Box>

        {loading && <Typography>Loading forecast...</Typography>}
        {error && (
          <Typography color="error">Could not load flood alerts: {error}</Typography>
        )}
        {!loading && !error && !forecast && (
          <Typography color="textSecondary">No forecast data</Typography>
        )}

        {!loading && !error && forecast && (
          <Box>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 1 }}>
              <Chip
                label={`Severity: ${active?.severity ?? "-"}`}
                color={severityColor(active?.severity)}
              />
              <Typography variant="body1">
                Rainfall (mm):{" "}
                <strong>{safeFixed(active?.rainfall_mm ?? "-", 0)}</strong>
              </Typography>
              <Typography variant="body1">
                Affected hotspots: <strong>{active?.affected_count ?? 0}</strong>
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ mb: 1 }}>
              {active?.message ?? ""}
            </Typography>

            <Typography variant="subtitle2">Recommended actions</Typography>
            <ul>
              {(active?.recommended_actions ?? []).map((a, i) => (
                <li key={i}>
                  <Typography variant="body2">{a}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        )}
      </Paper>

      {/* Map & marker area */}
      <Paper sx={{ height: "60vh", mb: 2 }}>
        <MapContainer
          center={mapCenter}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Fit bounds to points whenever points list changes */}
          <FitBounds points={points} />

          {/* Draw markers */}
          {points.map((p, idx) => {
            const lat = Number(p.lat);
            const lng = Number(p.lng);
            const props = p.properties || {};
            if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
            // CircleMarker to show hotspots clearly
            return (
              <CircleMarker
                key={idx}
                center={[lat, lng]}
                radius={6}
                pathOptions={{ color: "blue", fillColor: "cyan" }}
              >
                <Popup>
                  <div style={{ maxWidth: 220 }}>
                    <strong>Hotspot #{idx + 1}</strong>
                    <div>Lat: {safeFixed(lat, 5)}</div>
                    <div>Lng: {safeFixed(lng, 5)}</div>
                    {Object.keys(props).length > 0 && (
                      <>
                        <hr />
                        <div style={{ fontSize: 12 }}>
                          {Object.entries(props).map(([k, v]) => (
                            <div key={k}>
                              <strong>{k}:</strong> {String(v)}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </Paper>

      {/* list of hotspots for accessibility */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Hotspots (selected period)</Typography>
        {!active && <Typography>No data</Typography>}
        {active && active.affected_points.length === 0 && (
          <Typography>No hotspots affected (forecast low)</Typography>
        )}
        {active && active.affected_points.length > 0 && (
          <Box sx={{ maxHeight: 200, overflow: "auto", mt: 1 }}>
            {active.affected_points.map((pt, i) => (
              <Box
                key={i}
                sx={{
                  p: 1,
                  borderBottom: "1px solid #eee",
                }}
              >
                <Typography variant="body2">
                  <strong>#{i + 1}</strong> — {safeFixed(pt.lat, 5)}, {safeFixed(pt.lng, 5)}
                </Typography>
                <Typography variant="caption">
                  {pt.properties && Object.keys(pt.properties).length > 0 ? (
                    <>
                      {Object.entries(pt.properties)
                        .slice(0, 4)
                        .map(([k, v]) => (
                          <span key={k} style={{ display: "inline-block", marginRight: 10 }}>
                            <strong>{k}:</strong> {String(v)}
                          </span>
                        ))}
                    </>
                  ) : (
                    "No metadata"
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
