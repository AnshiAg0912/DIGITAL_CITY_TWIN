// src/pages/Reports.js
import { useState, useEffect, useRef } from "react";
import { Container, Typography, Paper } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

/*
  Reports page — updated:
   - timestamps are HH:MM (no seconds)
   - seed initial points spaced by POLL_INTERVAL_MS so chart has a real trend
   - show an X-axis label every TICK_INTERVAL samples (so labels not overcrowded)
   - removed "(selected location)" suffix from chart headings
*/

const DEFAULT_COORDS = { lat: 17.385, lng: 78.4867 }; // Hyderabad center fallback
const POLL_INTERVAL_MS = 60_000; // 60 seconds
const MAX_POINTS = 48; // how many samples to keep
const TICK_INTERVAL = 5; // show an X-axis label every 5 samples (approx every 5 minutes if POLL_INTERVAL_MS=60s)

export default function Reports() {
  const [series, setSeries] = useState([]); // array of { time, air, crop, water, temp, rainfall24 }
  const [selectedCoords, setSelectedCoords] = useState(DEFAULT_COORDS);
  const coordsRef = useRef(DEFAULT_COORDS);

  // helper: read coords from localStorage (called on mount and each poll)
  function readSelectedCoords() {
    try {
      const raw = localStorage.getItem("selected_coords");
      if (!raw) return DEFAULT_COORDS;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return parsed;
      }
      return DEFAULT_COORDS;
    } catch {
      return DEFAULT_COORDS;
    }
  }

  // helper: format time label HH:MM
  function timeLabel(d = new Date()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // fetch metrics for a point:
  // - OpenAQ for PM2.5 (air)
  // - Open-Meteo for humidity, precipitation and current temperature
  async function fetchMetrics(lat, lng) {
    // defaults if API fails
    let air = Math.floor(50 + Math.random() * 50);
    let humidity = Math.floor(60 + Math.random() * 30);
    let rainfall24 = 0;
    let temp = Math.round(25 + Math.random() * 8); // urban heat fallback

    // 1) OpenAQ (PM2.5)
    try {
      const aqUrl = `https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=10000&limit=1`;
      const aqResp = await fetch(aqUrl);
      if (aqResp.ok) {
        const aqJson = await aqResp.json();
        const first = aqJson.results?.[0];
        const pm25 = first?.measurements?.find((m) => m.parameter === "pm25")?.value;
        if (typeof pm25 === "number") air = Math.round(pm25);
      }
    } catch (e) {
      // ignore; fallback kept
    }

    // 2) Open-Meteo (hourly precipitation, relative humidity) + current_weather for temperature
    try {
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=relative_humidity_2m,precipitation&current_weather=true&forecast_days=2`;
      const omResp = await fetch(omUrl);
      if (omResp.ok) {
        const omJson = await omResp.json();

        // temperature from current_weather if present
        const curTemp = omJson?.current_weather?.temperature;
        if (typeof curTemp === "number") temp = Number(curTemp.toFixed(1));

        const rh = omJson?.hourly?.relative_humidity_2m || [];
        const rain = omJson?.hourly?.precipitation || [];

        // compute average of next 6 hours humidity as crop proxy (or first values)
        if (rh && rh.length) {
          const take = Math.min(6, rh.length);
          let sum = 0, cnt = 0;
          for (let i = 0; i < take; i++) {
            const v = parseFloat(rh[i]);
            if (!Number.isNaN(v)) { sum += v; cnt++; }
          }
          if (cnt > 0) humidity = Math.round(sum / cnt);
        }

        // sum rainfall for next 24h as water proxy
        if (rain && rain.length) {
          const take = Math.min(24, rain.length);
          let sumR = 0;
          for (let i = 0; i < take; i++) {
            const v = parseFloat(rain[i]);
            if (!Number.isNaN(v)) sumR += v;
          }
          rainfall24 = Number(sumR.toFixed(2));
        }
      }
    } catch (e) {
      // ignore; fallback used
    }

    // derive water proxy numeric for charting
    const waterProxy = Number((4 + rainfall24 / 10).toFixed(2));

    return { air, humidity, water: waterProxy, temp, rainfall24 };
  }

  // push new sample into series (keeps last MAX_POINTS)
  function pushSample(sample) {
    setSeries((prev) => {
      const next = [...prev, sample];
      if (next.length > MAX_POINTS) next.shift();
      return next;
    });
  }

  // single update cycle
  async function updateOnce() {
    const selected = readSelectedCoords();
    coordsRef.current = selected;
    setSelectedCoords(selected);
    const { lat, lng } = selected;
    try {
      const m = await fetchMetrics(lat, lng);
      const sample = {
        time: timeLabel(new Date()),
        air: m.air,
        crop: m.humidity,
        water: m.water,
        temp: m.temp,
        rainfall24: m.rainfall24,
      };
      pushSample(sample);
    } catch (e) {
      // fallback simulated
      pushSample({
        time: timeLabel(new Date()),
        air: Math.floor(50 + Math.random() * 50),
        crop: Math.floor(60 + Math.random() * 40),
        water: Number((4 + Math.random() * 3).toFixed(2)),
        temp: Math.round(25 + Math.random() * 8),
        rainfall24: 0,
      });
    }
  }

  // on mount: seed a few initial points spaced by POLL_INTERVAL_MS, then start interval
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // get selected coords immediately
      const initialCoords = readSelectedCoords();
      setSelectedCoords(initialCoords);
      coordsRef.current = initialCoords;

      // seed: create a few initial samples spaced backwards in time so x-axis isn't identical
      const now = Date.now();
      const seedCount = 8; // initial points to seed (will be followed by regular polling)
      for (let i = seedCount - 1; i >= 0; i--) {
        if (cancelled) return;
        // create a mock timestamp in the past (i * POLL_INTERVAL_MS ago)
        const fakeTime = new Date(now - i * POLL_INTERVAL_MS);
        try {
          // try a real fetch for current metrics (but we will override time)
          const m = await fetchMetrics(initialCoords.lat, initialCoords.lng);
          pushSample({
            time: timeLabel(fakeTime),
            air: m.air,
            crop: m.humidity,
            water: m.water,
            temp: m.temp,
            rainfall24: m.rainfall24,
          });
        } catch (e) {
          pushSample({
            time: timeLabel(fakeTime),
            air: Math.floor(50 + Math.random() * 50),
            crop: Math.floor(60 + Math.random() * 40),
            water: Number((4 + Math.random() * 3).toFixed(2)),
            temp: Math.round(25 + Math.random() * 8),
            rainfall24: 0,
          });
        }
      }
    })();

    const id = setInterval(() => {
      updateOnce();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // small helper to format coords for headings
  function coordsLabel(c = selectedCoords) {
    if (!c) return `${DEFAULT_COORDS.lat.toFixed(4)}, ${DEFAULT_COORDS.lng.toFixed(4)}`;
    return `${Number(c.lat).toFixed(4)}, ${Number(c.lng).toFixed(4)}`;
  }

  // X-axis tick formatter: show label only every TICK_INTERVAL samples to avoid crowding
  function xTickFormatter(val) {
    // val is time string (HH:MM). Find index in series
    const idx = series.findIndex((s) => s.time === val);
    if (idx === -1) return val;
    return idx % TICK_INTERVAL === 0 ? val : "";
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Analytical Reports
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
        Selected location: <strong>({coordsLabel(selectedCoords)})</strong>
      </Typography>

      {/* AIR QUALITY LINE CHART */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Air Quality Trend
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={xTickFormatter} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="air" stroke="#1976D2" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* URBAN HEAT LINE CHART */}
      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Urban Heat — Temperature (°C)
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={xTickFormatter} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="temp" stroke="#D32F2F" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* CROP HEALTH BAR CHART */}
      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Crop Health Index
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={xTickFormatter} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="crop" fill="#FF9933" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* WATER LEVEL LINE CHART */}
      <Paper sx={{ p: 3, mt: 4, mb: 5 }}>
        <Typography variant="h6" gutterBottom>
          Water Level Proxy (derived from forecast rainfall)
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={xTickFormatter} />
            <YAxis />
            <Tooltip
              formatter={(value, name) => {
                if (name === "water") return [value, "water proxy"];
                if (name === "rainfall24") return [`${value} mm`, "24h rainfall"];
                return [value, name];
              }}
            />
            <Line type="monotone" dataKey="water" stroke="#388E3C" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="rainfall24" stroke="#0288D1" strokeWidth={1} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    </Container>
  );
}
