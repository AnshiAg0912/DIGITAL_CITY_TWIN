import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";

import {
  MapContainer,
  TileLayer,
  Marker,
  GeoJSON,
  useMapEvents,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getDIGIPINFromLatLon } from "digipin"; // keep as before

// Fix Leaflet marker assets
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// --- small helper map click component ---
function MapClickLayer({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// haversine distance (km) - kept though not used for drawing
function distKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// severity -> color chip
function SeverityChip({ severity }) {
  const map = {
    low: { label: "Low", color: "success" },
    moderate: { label: "Moderate", color: "warning" },
    high: { label: "High", color: "error" },
    critical: { label: "Critical", color: "error" },
  };
  const info = map[severity] || { label: severity || "Unknown", color: "default" };
  return <Chip label={info.label} color={info.color} size="small" />;
}

export default function DisasterManagement() {
  // Form state
  const [scenarioName, setScenarioName] = useState("");
  const [interventionType, setInterventionType] = useState("road");
  const [rainfall, setRainfall] = useState(50); // 25-100
  const [approxLength, setApproxLength] = useState("");
  const [lanes, setLanes] = useState("");

  // Map + selection state (no drawing)
  const [digipins, setDigipins] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  // mode only origin|destination now
  const [mode, setMode] = useState("origin"); // origin | destination

  // Flood GeoJSON
  const [floodGeo, setFloodGeo] = useState(null);

  // Results
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // load flood geojson
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/hyd_flood_points.geojson");
        if (!r.ok) throw new Error("GeoJSON fetch failed");
        const geo = await r.json();
        if (!cancelled) setFloodGeo(geo);
      } catch (e) {
        console.warn("Could not load flood geojson:", e);
      }
    })();
    return () => (cancelled = true);
  }, []);

  // Keep roadPoints state for compatibility (empty), but not used for drawing
  const [roadPoints] = useState([]); // always empty since drawing removed

  // handle map clicks: only origin/destination allowed
  const handleMapClick = (lat, lng) => {
    if (mode === "origin") {
      setOrigin({ lat, lng });
      // add DIGIPIN for origin
      try {
        const pin = getDIGIPINFromLatLon(lat, lng);
        setDigipins((d) => [...d, pin]);
      } catch (e) {
        console.warn("DIGIPIN error:", e);
      }
      // optionally switch to destination mode for convenience
      setMode("destination");
      return;
    }
    if (mode === "destination") {
      setDestination({ lat, lng });
      // add DIGIPIN for destination
      try {
        const pin = getDIGIPINFromLatLon(lat, lng);
        setDigipins((d) => [...d, pin]);
      } catch (e) {
        console.warn("DIGIPIN error:", e);
      }
      // optionally switch back to origin after setting destination
      setMode("origin");
      return;
    }
    // otherwise do nothing (no draw)
  };

  const lastDIGIPIN = digipins.length ? digipins[digipins.length - 1] : "--";

  // Run simulation (calls backend)
  const handleRunSimulation = async () => {
    setLoading(true);
    setResults(null);
    try {
      const payload = {
        scenarioName,
        interventionType,
        rainfall,
        approxLength: approxLength ? Number(approxLength) : null,
        lanes: lanes ? Number(lanes) : null,
        roadPoints: [], // no drawn road; backend will use approxLength or other heuristics
        origin,
        destination,
      };

      const res = await fetch("http://localhost:8000/api/disaster/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Simulation error:", err);
      setResults({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  // reset selection (clears origin/destination & digipins)
  const handleReset = () => {
    setScenarioName("");
    setInterventionType("road");
    setRainfall(50);
    setApproxLength("");
    setLanes("");
    setDigipins([]);
    setOrigin(null);
    setDestination(null);
    setMode("origin");
    setResults(null);
  };

  // Download CSV report (unchanged)
  const downloadReport = () => {
    if (!results) return;
    const rows = [];
    rows.push(["Scenario Name", scenarioName || "—"]);
    rows.push(["Intervention Type", interventionType]);
    rows.push(["Rainfall (design mm)", rainfall]);
    rows.push(["Approx length (km)", approxLength || "—"]);
    rows.push(["Lanes", lanes || "—"]);
    rows.push(["Origin", origin ? `${origin.lat},${origin.lng}` : "—"]);
    rows.push(["Destination", destination ? `${destination.lat},${destination.lng}` : "—"]);
    rows.push([]);
    rows.push(["Traffic: baseline min", results?.traffic?.baselineMinutes ?? "—"]);
    rows.push(["Traffic: scenario min", results?.traffic?.scenarioMinutes ?? "—"]);
    rows.push(["Traffic: change (min)", results?.traffic?.minutesChange ?? "—"]);
    rows.push([]);
    rows.push(["Flood: baseline high-risk cells", results?.flood?.baselineHighRiskCells ?? "—"]);
    rows.push(["Flood: scenario high-risk cells", results?.flood?.scenarioHighRiskCells ?? "—"]);
    rows.push(["Flood: baseline pop", results?.flood?.baselinePop ?? "—"]);
    rows.push(["Flood: scenario pop", results?.flood?.scenarioPop ?? "—"]);
    rows.push([]);
    rows.push(["Notes", results?.notes ?? "—"]);

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = (scenarioName || "scenario_report").replace(/\s+/g, "_");
    a.download = `${name}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // flood GeoJSON styling
  const floodPointOptions = {
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        fillColor: "#ff3b3b",
        color: "#7f0000",
        weight: 1,
        fillOpacity: 0.9,
      }),
    onEachFeature: (feature, layer) => {
      const props = feature.properties || {};
      let txt = "<strong>Flood hotspot</strong>";
      if (props.name) txt += `<br/><em>${props.name}</em>`;
      if (props.description) txt += `<br/>${props.description}`;
      if (props.digipin) txt += `<br/>DIGIPIN: ${props.digipin}`;
      layer.bindPopup(txt);
      layer.bindTooltip("Flood hotspot", { direction: "top" });
    },
  };

  const affectedPoints = results && results.flood && results.flood.affected_points ? results.flood.affected_points : [];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Disaster Management — Hyderabad Digital Twin
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Click to set origin and destination on the map (no drawing). Flood hotspots (local dataset) are red. Results show traffic & flood impacts; download a simple CSV report.
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Grid container spacing={3}>
        {/* Left: Map */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ height: 640 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="h6">Map & Scenario Editor</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ToggleButtonGroup size="small" value={mode} exclusive onChange={(_, v) => v && setMode(v)}>
                    <ToggleButton value="origin">Set Origin</ToggleButton>
                    <ToggleButton value="destination">Set Destination</ToggleButton>
                  </ToggleButtonGroup>
                  <Button size="small" variant="outlined" onClick={() => { setDigipins([]); setOrigin(null); setDestination(null); }}>
                    Clear Selection
                  </Button>
                </Stack>
              </Box>

              <Typography variant="body2" color="text.secondary">
                Mode: <strong>{mode}</strong> • Click on map to set the selected point.
              </Typography>

              <Box sx={{ mt: 2, height: "85%", borderRadius: 2, overflow: "hidden", border: "1px solid #ddd" }}>
                <MapContainer center={[17.385, 78.4867]} zoom={13} style={{ height: "100%", width: "100%" }} doubleClickZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

                  {origin && <Marker position={[origin.lat, origin.lng]}><Popup>Origin</Popup></Marker>}
                  {destination && <Marker position={[destination.lat, destination.lng]}><Popup>Destination</Popup></Marker>}

                  {floodGeo && <GeoJSON data={floodGeo} {...floodPointOptions} />}

                  {Array.isArray(affectedPoints) && affectedPoints.length > 0 && affectedPoints.map((p, i) => (
                    <Marker key={`aff-${i}`} position={[p.lat, p.lng]} icon={
                      new L.Icon({
                        iconUrl: require("leaflet/dist/images/marker-icon.png"),
                        shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        className: "affected-marker",
                      })
                    }>
                      <Popup>
                        <div>
                          <strong>Affected hotspot</strong><br />
                          {p.properties && Object.keys(p.properties).slice(0,5).map((k) => <div key={k}><small>{k}: {String(p.properties[k])}</small></div>)}
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  <MapClickLayer onMapClick={handleMapClick} />
                </MapContainer>
              </Box>

              {/* removed the under-map selection summary so it sits on the right side now */}
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Controls & results (selection summary moved here) */}
        <Grid item xs={12} md={5}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Scenario Controls</Typography>

              <TextField fullWidth label="Scenario Name" sx={{ mt: 1 }} value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="e.g. New bridge at XYZ" />

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Intervention Type</InputLabel>
                <Select value={interventionType} label="Intervention Type" onChange={(e) => setInterventionType(e.target.value)}>
                  <MenuItem value="road">New Road / Bridge</MenuItem>
                  <MenuItem value="drain">Drainage Channel</MenuItem>
                  <MenuItem value="green">Green / Retention Zone</MenuItem>
                  <MenuItem value="restriction">No-Build / Restriction</MenuItem>
                </Select>
              </FormControl>

              <Typography sx={{ mt: 2 }} variant="subtitle2">Rainfall Scenario (Design Storm)</Typography>
              <Slider value={rainfall} min={25} max={100} step={25} marks={[{ value: 25, label: "Moderate" }, { value: 50, label: "High" }, { value: 75, label: "Severe" }, { value: 100, label: "Extreme" }]} onChange={(_, v) => setRainfall(v)} />

              <TextField fullWidth label="Approx. length (km) — optional" sx={{ mt: 2 }} value={approxLength} onChange={(e) => setApproxLength(e.target.value)} helperText="If empty, use expert estimate." />

              <TextField fullWidth label="Lanes / capacity" sx={{ mt: 2 }} value={lanes} onChange={(e) => setLanes(e.target.value)} type="number" />

              <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
                <Button fullWidth variant="contained" color="primary" onClick={handleRunSimulation} disabled={loading}>
                  {loading ? <><CircularProgress size={18} sx={{ mr: 1 }} /> Running...</> : "Run Simulation"}
                </Button>
                <Button fullWidth variant="outlined" color="secondary" onClick={handleReset}>Reset</Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* SELECTION SUMMARY (moved from below map) */}
              <Typography variant="subtitle2">Selection Summary</Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">Origin: <strong>{origin ? `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}` : "--"}</strong></Typography>
                <Typography variant="body2">Destination: <strong>{destination ? `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}` : "--"}</strong></Typography>
                <Typography variant="body2">Last DIGIPIN: <strong>{lastDIGIPIN}</strong></Typography>
                <Typography variant="body2">Total DIGIPIN points: <strong>{digipins.length}</strong></Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2">DIGIPIN (last clicks)</Typography>
                <Typography variant="caption" sx={{ ml: "auto" }}>{digipins.length} points</Typography>
              </Stack>
              <Box sx={{ mt: 1, maxHeight: 80, overflow: "auto" }}>
                <Stack spacing={0.5}>
                  {digipins.slice().reverse().slice(0, 8).map((d, i) => (
                    <Chip key={i} label={d} size="small" />
                  ))}
                  {digipins.length === 0 && <Typography variant="caption" color="text.secondary">No DIGIPINs yet — click on map</Typography>}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* Results card */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Impact Assessment</Typography>

              {!results && !loading && <Typography variant="body2" color="text.secondary">Run the simulation to see traffic & flood impacts. Results will appear here and affected hotspots (if any) will highlight on the map.</Typography>}

              {loading && <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}><CircularProgress size={20} /> <Typography>Running model…</Typography></Box>}

              {results?.error && <Typography color="error" sx={{ mt: 1 }}>{results.error}</Typography>}

              {results && !results.error && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} sm={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Typography variant="subtitle2">Traffic Impact</Typography>
                          <Typography variant="body2" sx={{ ml: "auto" }}>
                            {results.traffic?.baselineMinutes != null && results.traffic?.scenarioMinutes != null ? (
                              <>
                                Baseline <strong>{Number(results.traffic.baselineMinutes).toFixed(1)} min</strong> → Scenario <strong>{Number(results.traffic.scenarioMinutes).toFixed(1)} min</strong>
                                <br />
                                Change: <strong style={{ color: results.traffic.minutesChange < 0 ? "green" : "red" }}>{Number(results.traffic.minutesChange).toFixed(2)} min</strong>
                              </>
                            ) : (
                              <>Using simplified travel-time model. Change: <strong>{Number(results.traffic?.minutesChange ?? 0).toFixed(2)} min</strong></>
                            )}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="subtitle2">Flood Risk Impact</Typography>
                          <Box sx={{ ml: 1 }}><SeverityChip severity={results?.flood?.severity || (results?.flood?.scenarioHighRiskCells && results.flood.scenarioHighRiskCells > results.flood.baselineHighRiskCells ? "high" : "moderate")} /></Box>
                        </Stack>

                        <Typography variant="body2" sx={{ mt: 1 }}>
                          High-risk cells: <strong>{results.flood?.baselineHighRiskCells ?? "—"} → {results.flood?.scenarioHighRiskCells ?? "—"}</strong>
                          <br />
                          Exposed population: <strong>{results.flood?.baselinePop?.toLocaleString() ?? "—"} → {results.flood?.scenarioPop?.toLocaleString() ?? "—"}</strong>
                        </Typography>

                        {results.flood?.affected_count != null && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Affected hotspots (predicted): <strong>{results.flood.affected_count}</strong>
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">Notes & Recommendations</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>{results.notes || "No notes provided."}</Typography>

                        {results.flood?.recommended_actions && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="subtitle2">Recommended actions</Typography>
                            <ul>
                              {results.flood.recommended_actions.map((a, i) => <li key={i}><small>{a}</small></li>)}
                            </ul>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button variant="contained" onClick={downloadReport}>Download CSV Report</Button>
                      <Button variant="outlined" onClick={() => window.print()}>Print</Button>
                      <Button variant="text" onClick={() => setResults(null)}>Clear Results</Button>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
