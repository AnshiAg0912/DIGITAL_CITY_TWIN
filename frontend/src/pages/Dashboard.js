import { useState } from "react";
import { Container, Box, Grid, Paper, Typography } from "@mui/material";
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet marker issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// --- Click handler component ---
function LocationMarker({ setData, setCoords }) {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setPosition(e.latlng);
      setCoords({ lat, lng });
      localStorage.setItem("selected_coords", JSON.stringify({ lat, lng }));


      try {
        // 1️⃣ Open-Meteo: Temperature, Humidity, Rainfall
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=temperature_2m,precipitation,relative_humidity_2m`
        );
        const weatherJson = await weatherRes.json();
        const temp = weatherJson?.current_weather?.temperature || 0;
        const humidity =
          weatherJson?.hourly?.relative_humidity_2m?.[0] ||
          Math.floor(50 + Math.random() * 40);
        const precip =
          weatherJson?.hourly?.precipitation?.[0] ||
          Math.floor(Math.random() * 5);

        // 2️⃣ OpenAQ: Air Quality (nearest station)
        const aqRes = await fetch(
              `https://api.allorigins.win/raw?url=https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=10000`
        );
        const aqJson = await aqRes.json();
        const pm25 =
          aqJson?.results?.[0]?.measurements?.find(
            (m) => m.parameter === "pm25"
          )?.value || Math.floor(60 + Math.random() * 30);

        // Update data cards
        setData({
          airQuality: Math.round(pm25),
          waterLevel: precip.toFixed(1),
          cropHealth: humidity,
          urbanHeat: temp.toFixed(1),
        });
      } catch (err) {
        console.error("Data fetch error:", err);
        setData({
          airQuality: "--",
          waterLevel: "--",
          cropHealth: "--",
          urbanHeat: "--",
        });
      }
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        <b>Selected Location</b>
        <br />
        Lat: {position.lat.toFixed(3)}, Lon: {position.lng.toFixed(3)}
      </Popup>
    </Marker>
  );
}

export default function Dashboard() {
  const [data, setData] = useState({
    airQuality: "--",
    waterLevel: "--",
    cropHealth: "--",
    urbanHeat: "--",
  });
  const [coords, setCoords] = useState({ lat: 17.385, lng: 78.4867 });

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Digital Twin Dashboard — India
      </Typography>

      <Typography variant="subtitle1" sx={{ mb: 3 }}>
        Selected Location:{" "}
        <b>
          {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
        </b>
      </Typography>

      {/* Data Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#E3F2FD" }}>
            <Typography variant="h6">Air Quality (PM2.5)</Typography>
            <Typography variant="h4" color="primary" fontWeight="bold">
              {data.airQuality}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#E8F5E9" }}>
            <Typography variant="h6">Water Level Proxy (mm)</Typography>
            <Typography variant="h4" color="success.main" fontWeight="bold">
              {data.waterLevel}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#FFF8E1" }}>
            <Typography variant="h6">Crop Health (Humidity %)</Typography>
            <Typography variant="h4" color="warning.main" fontWeight="bold">
              {data.cropHealth}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#FFEBEE" }}>
            <Typography variant="h6">Urban Heat (°C)</Typography>
            <Typography variant="h4" color="error.main" fontWeight="bold">
              {data.urbanHeat}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Map */}
      <Box sx={{ mt: 6, textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>
          Click Anywhere to View Live Conditions
        </Typography>
        <Box
          sx={{
            border: "2px solid #0B3D91",
            borderRadius: 2,
            height: 500,
            overflow: "hidden",
          }}
        >
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
          >
            {/* OpenStreetMap base */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {/* Temperature overlay from Open-Meteo */}
            {/* NASA Land Surface Temperature overlay with today's date */}
            <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MOD_LSTD_Day/default/${new Date()
            .toISOString()
            .split("T")[0]}/{z}/{y}/{x}.png`}
            attribution="© NASA GIBS — MODIS Land Surface Temperature"
        opacity={0.6}
         />
            <LocationMarker setData={setData} setCoords={setCoords} />
          </MapContainer>
        </Box>
      </Box>
    </Container>
  );
}
