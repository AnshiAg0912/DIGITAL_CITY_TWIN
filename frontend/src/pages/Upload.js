// src/pages/Upload.js
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Stack,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";

// ---- Marker icon fix for Leaflet in CRA ----
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// ---------- Small helper: deterministic 'DIGIPIN' ----------
function generateDIGIPIN(lat, lng) {
  const a = Math.abs(Math.round(lat * 10000));
  const b = Math.abs(Math.round(lng * 10000));
  const part1 = (a % 1000).toString().padStart(3, "0");
  const part2 = (b % 1000).toString().padStart(3, "0");
  const part3 = ((a + b) % 10000).toString(36).toUpperCase().padStart(4, "0");
  return `${part1}-${part2}-${part3}`;
}

// ---------- Map click component ----------
function MapClick({ onClick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onClick(lat, lng);
    },
  });
  return null;
}

// ---------- Category colors + icon ----------
const CATEGORY_COLORS = {
  waste: "#FF7043",
  traffic: "#1976D2",
  water: "#0288D1",
  other: "#8E24AA",
};

function iconForCategory(category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return L.divIcon({
    className: "custom-pin",
    html: `<span style="
      display:inline-block;
      border-radius:50%;
      width:18px;height:18px;
      background:${color};
      box-shadow:0 0 0 3px rgba(0,0,0,0.08);
      border:2px solid white;"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -18],
  });
}

// ---------- Persistence helpers ----------
const LEGACY_STORAGE_KEY = "citizen_uploads_v1"; // your old key
const STORAGE_KEY = "dt_uploads"; // admin expects dt_uploads
function loadUploads() {
  try {
    // prefer new key, fallback to legacy
    const rawNew = localStorage.getItem(STORAGE_KEY);
    if (rawNew) return JSON.parse(rawNew);
    const rawOld = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawOld) return JSON.parse(rawOld);
    return [];
  } catch (e) {
    console.warn("Could not parse uploads", e);
    return [];
  }
}
function saveUploads(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // keep legacy copy for compatibility
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Could not save uploads", e);
  }
}

// ---------- Helper: get current logged-in demo user ----------
function getCurrentUser() {
  try {
    const raw = localStorage.getItem("dt_current_user");
    if (!raw) return null;
    return JSON.parse(raw); // expected shape { email, digipin }
  } catch {
    return null;
  }
}

// ---------- Helper: get public IP (best-effort) ----------
async function fetchPublicIP() {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (!r.ok) return null;
    const j = await r.json();
    return j.ip || null;
  } catch {
    return null;
  }
}

// ---------- Main component ----------
export default function Upload() {
  const [mapRef, setMapRef] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [category, setCategory] = useState("waste");
  const [description, setDescription] = useState("");
  const [fileObj, setFileObj] = useState(null);

  const [uploads, setUploads] = useState(() => loadUploads());
  const [searching, setSearching] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now()); // to reset file input UI after upload

  useEffect(() => {
    if (!mapRef) return;
    const t = setTimeout(() => {
      try {
        mapRef.invalidateSize();
      } catch (e) {}
    }, 100);
    return () => clearTimeout(t);
  }, [mapRef]);

  async function doSearch(q) {
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}&addressdetails=0`;
      const r = await fetch(url, { headers: { "Accept-Language": "en" } });
      const j = await r.json();
      const simplified = j.map((item) => ({
        display_name: item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon),
      }));
      setSearchResults(simplified);
    } catch (e) {
      console.error("Search error", e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(place) {
    const lat = place.lat;
    const lng = place.lon;
    const digipin = generateDIGIPIN(lat, lng);
    const obj = { lat, lng, display_name: place.display_name, digipin };
    setSelectedPlace(obj);
    setSearchResults([]);
    setSearchText("");
    if (mapRef) mapRef.setView([lat, lng], 16, { animate: true });
  }

  function handleMapClick(lat, lng) {
    const digipin = generateDIGIPIN(lat, lng);
    const obj = {
      lat,
      lng,
      display_name: `Point: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      digipin,
    };
    setSelectedPlace(obj);
  }

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    setFileObj(f || null);
  }

  async function handleUpload() {
    if (!selectedPlace) {
      alert("Please select a place (search or click on map) before uploading.");
      return;
    }
    if (!fileObj) {
      alert("Please choose a file to upload.");
      return;
    }

    // attempt to get public IP (best-effort)
    const ip = await fetchPublicIP();

    // current logged-in user (demo/local)
    const currentUser = getCurrentUser(); // may be null

    let filename = fileObj.name;
    let preview = null;
    try {
      preview = URL.createObjectURL(fileObj);
    } catch (e) {
      preview = null;
    }

    const newRecord = {
      id: Date.now() + "-" + Math.round(Math.random() * 10000),
      digipin: selectedPlace.digipin,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      place_name: selectedPlace.display_name,
      category,
      description,
      filename,
      preview,
      timestamp: new Date().toISOString(),

      // >>> additional metadata for admin
      email: currentUser?.email || null,
      uploaderDigipin: currentUser?.digipin || null,
      ip: ip || null,
    };

    const updated = [newRecord, ...uploads];
    setUploads(updated);
    saveUploads(updated);

    // clear form but keep selected place
    setDescription("");
    setFileObj(null);
    setFileInputKey(Date.now());
  }

  function removeUpload(id) {
    const filtered = uploads.filter((u) => u.id !== id);
    setUploads(filtered);
    saveUploads(filtered);
  }

  function clearAll() {
    if (!window.confirm("Clear all uploads from local storage? This cannot be undone.")) return;
    setUploads([]);
    saveUploads([]);
  }

  function downloadCSV() {
    if (!uploads.length) {
      alert("No uploads to download.");
      return;
    }
    const rows = [
      [
        "id",
        "digipin",
        "lat",
        "lng",
        "place_name",
        "category",
        "description",
        "filename",
        "timestamp",
        "email",
        "uploaderDigipin",
        "ip",
      ],
    ];
    uploads.forEach((u) => {
      rows.push([
        u.id,
        u.digipin,
        u.lat,
        u.lng,
        (u.place_name || "").replace(/"/g, '""'),
        u.category,
        (u.description || "").replace(/"/g, '""'),
        u.filename,
        u.timestamp,
        u.email || "",
        u.uploaderDigipin || "",
        u.ip || "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c || "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uploads_${new Date().toISOString().slice(0,19).replace(/[:T]/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    return () => {
      uploads.forEach((u) => {
        if (u.preview) try { URL.revokeObjectURL(u.preview); } catch (_) {}
      });
    };
    // eslint-disable-next-line
  }, []);

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Citizen Upload Portal — Hyderabad
      </Typography>

      <Typography variant="body1" sx={{ mb: 2 }}>
        Search a place or click on the map to get its DIGIPIN. Attach a file (photo/video) and select category — the upload will appear on the map and in the list below.
      </Typography>

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* Left column: controls */}
        <Box sx={{ width: 420 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">Find place & DIGIPIN</Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <TextField
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doSearch(searchText);
                  }}
                  placeholder="Search place (street, area, landmark)"
                  fullWidth
                />
                <Button variant="contained" onClick={() => doSearch(searchText)} disabled={searching}>
                  {searching ? "..." : "Search"}
                </Button>
              </Stack>

              <Box sx={{ mt: 2 }}>
                {searchResults.length > 0 && (
                  <Stack spacing={1}>
                    {searchResults.map((r, i) => (
                      <Box key={i} sx={{ p: 1, borderRadius: 1, border: "1px solid #eee", cursor: "pointer" }} onClick={() => pickPlace(r)}>
                        <Typography variant="body2">{r.display_name}</Typography>
                        <Typography variant="caption">{r.lat.toFixed(5)}, {r.lon.toFixed(5)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Selected location</Typography>
                {selectedPlace ? (
                  <>
                    <Typography variant="body2">{selectedPlace.place_name || selectedPlace.display_name}</Typography>
                    <Typography variant="caption">Lat {selectedPlace.lat.toFixed(5)}, Lon {selectedPlace.lng.toFixed(5)}</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip label={`DIGIPIN: ${selectedPlace.digipin}`} color="primary" />
                    </Box>
                  </>
                ) : (
                  <Typography variant="caption" color="text.secondary">No place selected — search or click on the map.</Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">Upload for DIGIPIN</Typography>

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Category</InputLabel>
                <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
                  <MenuItem value="waste">waste</MenuItem>
                  <MenuItem value="traffic">traffic</MenuItem>
                  <MenuItem value="water">water logging / drainage</MenuItem>
                  <MenuItem value="other">other</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                sx={{ mt: 2 }}
                multiline
                rows={3}
                placeholder="Short description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Box sx={{ mt: 2, display: "flex", gap: 1, alignItems: "center" }}>
                <label htmlFor="file-input">
                  <input key={fileInputKey} id="file-input" type="file" style={{ display: "none" }} onChange={onFileChange} />
                  <Button variant="contained" component="span">Choose File</Button>
                </label>
                <Typography variant="body2">{fileObj ? fileObj.name : "No file chosen"}</Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={handleUpload} disabled={!selectedPlace || !fileObj}>UPLOAD</Button>
                <Button variant="outlined" onClick={() => { setDescription(""); setFileObj(null); setFileInputKey(Date.now()); }}>CLEAR</Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography variant="h6">All Uploads ({uploads.length})</Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Download CSV">
                  <IconButton size="small" onClick={downloadCSV}><DownloadIcon /></IconButton>
                </Tooltip>
                <Tooltip title="Clear all uploads">
                  <IconButton size="small" onClick={clearAll}><DeleteIcon /></IconButton>
                </Tooltip>
              </Box>

              {uploads.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No uploads to show.</Typography>
              ) : (
                <Stack spacing={1}>
                  {uploads.map((u) => (
                    <Box key={u.id} sx={{ p: 1, border: "1px solid #f0f0f0", borderRadius: 1, display: "flex", alignItems: "center" }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2"><strong>{u.category}</strong> — {u.place_name || u.digipin}</Typography>
                        <Typography variant="caption">{u.filename} • {new Date(u.timestamp).toLocaleString()}</Typography>
                        {/* show uploader info if present */}
                        {(u.email || u.ip) && (
                          <Typography variant="caption" display="block" sx={{ color: "text.secondary" }}>
                            {u.email ? `By: ${u.email}` : ""} {u.ip ? ` • IP: ${u.ip}` : ""}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => { if (mapRef) mapRef.setView([u.lat, u.lng], 16, { animate: true }); }}>View</Button>
                        <Button size="small" color="error" onClick={() => removeUpload(u.id)}>Remove</Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Right column: map */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent sx={{ p: 0, height: 720 }}>
              <MapContainer
                center={[17.385, 78.4867]}
                zoom={12}
                style={{ width: "100%", height: "100%" }}
                whenCreated={(mapInstance) => setMapRef(mapInstance)}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                {uploads.map((u) => (
                  <Marker key={u.id} position={[u.lat, u.lng]} icon={iconForCategory(u.category)}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>{u.category}</strong><br />
                        {u.place_name && <div style={{ fontSize: 12 }}>{u.place_name}</div>}
                        <div style={{ marginTop: 6 }}><small>{u.filename}</small></div>
                        <div style={{ marginTop: 6 }}><small>{new Date(u.timestamp).toLocaleString()}</small></div>
                        {u.email && <div style={{ marginTop: 6 }}><small>By: {u.email}</small></div>}
                        {u.ip && <div><small>IP: {u.ip}</small></div>}
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {selectedPlace && (
                  <Marker position={[selectedPlace.lat, selectedPlace.lng]}>
                    <Popup>
                      <div>
                        <strong>Selected</strong><br />
                        DIGIPIN: {selectedPlace.digipin}<br />
                        {selectedPlace.place_name || selectedPlace.display_name}
                      </div>
                    </Popup>
                  </Marker>
                )}

                <MapClick onClick={handleMapClick} />
              </MapContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}
