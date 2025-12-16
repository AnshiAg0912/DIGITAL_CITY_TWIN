# backend/main.py
# ================================
# DIGITAL TWIN - BACKEND (FastAPI)
# ================================

from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Literal, Optional, Any, Dict
from math import radians, sin, cos, atan2, sqrt
import geopandas as gpd
from shapely.geometry import LineString
import requests
from datetime import datetime, timezone
import osmnx as ox
import networkx as nx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("digital_twin_backend")

# -------------------------
# LOAD FLOOD POINTS
# -------------------------
try:
    flood_points = gpd.read_file("data/hyd_flood_points.geojson").to_crs(epsg=4326)
    logger.info("Loaded flood points: %d", len(flood_points))
except Exception as e:
    logger.exception("Error loading flood points: %s", e)
    flood_points = None

# -------------------------
# LOAD ROAD GRAPH (optional)
# -------------------------
try:
    road_graph = ox.load_graphml("data/hyd_road_graph.graphml")
    logger.info("Loaded Hyderabad road graph")
except Exception as e:
    logger.warning("Could not load road graph: %s", e)
    road_graph = None

# -------------------------
# FASTAPI + CORS
# -------------------------
app = FastAPI(title="Digital Twin Backend")

# Development CORS: allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Pydantic models
# -------------------------
class LatLng(BaseModel):
    lat: float
    lng: float

class ScenarioRequest(BaseModel):
    scenarioName: Optional[str] = None
    interventionType: Literal["road", "drain", "green", "restriction"]
    rainfall: int
    approxLength: Optional[float] = None
    lanes: Optional[int] = None
    roadPoints: List[LatLng] = []
    origin: Optional[LatLng] = None
    destination: Optional[LatLng] = None

class TrafficResult(BaseModel):
    minutesChange: float
    baselineMinutes: Optional[float] = None
    scenarioMinutes: Optional[float] = None

class FloodResult(BaseModel):
    baselineHighRiskCells: int
    scenarioHighRiskCells: int
    baselinePop: int
    scenarioPop: int

class ScenarioResponse(BaseModel):
    traffic: TrafficResult
    flood: FloodResult
    notes: str

class AlertPoint(BaseModel):
    lat: float
    lng: float
    properties: Dict[str, Any]

class AlertResponse(BaseModel):
    severity: Literal["low", "moderate", "high", "critical"]
    affected_count: int
    affected_points: List[AlertPoint]
    message: str
    recommended_actions: List[str]
    rainfall_mm: float

# -------------------------
# Helpers
# -------------------------
def to_native(value):
    """
    Convert numpy/pandas types to Python native types for JSON.
    """
    try:
        if value is None:
            return None
        # pandas/numpy types often have item() or are convertible with float()/int()
        if hasattr(value, "item"):
            return value.item()
        if isinstance(value, (float, int, str, bool)):
            return value
        return str(value)
    except Exception:
        return str(value)

def row_properties_safe(row) -> Dict[str, Any]:
    """
    Convert a GeoDataFrame row (Series) into a JSON-serializable dict,
    excluding geometry and converting types.
    """
    d = {}
    for k, v in row.items():
        if k == "geometry":
            continue
        d[k] = to_native(v)
    return d

def classify_severity(rainfall_mm: float) -> str:
    if rainfall_mm < 10:
        return "low"
    if rainfall_mm < 25:
        return "moderate"
    if rainfall_mm < 50:
        return "high"
    return "critical"

def distance_km(a: LatLng, b: LatLng) -> float:
    R = 6371
    dlat = radians(b.lat - a.lat)
    dlon = radians(b.lng - a.lng)
    lat1 = radians(a.lat)
    lat2 = radians(b.lat)
    h = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    c = 2 * atan2(sqrt(h), sqrt(1 - h))
    return R * c

def compute_length_from_points(points: List[LatLng]) -> float:
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(points)):
        total += distance_km(points[i-1], points[i])
    return total

def nearest_node(lat, lng):
    if road_graph is None:
        return None
    try:
        return ox.distance.nearest_nodes(road_graph, X=[lng], Y=[lat])[0]
    except Exception:
        return None

def compute_od_time(origin: LatLng, dest: LatLng, temp_edges=None):
    if road_graph is None:
        return None
    G = road_graph.copy()
    if temp_edges:
        for u, v, length_km, speed in temp_edges:
            t = (length_km / speed) * 3600.0
            G.add_edge(u, v, travel_time=t)
            G.add_edge(v, u, travel_time=t)
    u = nearest_node(origin.lat, origin.lng)
    v = nearest_node(dest.lat, dest.lng)
    if u is None or v is None:
        return None
    try:
        route = nx.shortest_path(G, u, v, weight="travel_time")
        return nx.path_weight(G, route, weight="travel_time")
    except Exception as e:
        logger.debug("Routing error: %s", e)
        return None

# -------------------------
# Forecast fetcher (Open-Meteo)
# -------------------------
def get_forecast_rainfall(lat: float, lng: float, hours: int = 24) -> float:
    """
    Fetch hourly rainfall using Open-Meteo and sum next `hours` hours.
    Returns float rainfall in mm.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lng,
        "hourly": "rain",
        "forecast_days": 3,
        "timezone": "UTC",
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    rains = hourly.get("rain", [])
    if not times or not rains:
        return 0.0

    now = datetime.now(timezone.utc)
    total = 0.0
    count = 0
    for t_str, rr in zip(times, rains):
        try:
            # open-meteo returns ISO strings; they may or may not have timezone suffix
            dt = datetime.fromisoformat(t_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if dt >= now and count < hours:
            total += float(rr or 0.0)
            count += 1
    return float(total)

# -------------------------
# Generate alert from rainfall
# -------------------------
def generate_alert_from_rainfall(rainfall_mm: float, bbox: Optional[List[float]] = None):
    if flood_points is None:
        raise RuntimeError("Flood points dataset not loaded on server.")

    pts = flood_points
    if bbox and len(bbox) == 4:
        minx, miny, maxx, maxy = bbox
        pts = pts.cx[minx:maxx, miny:maxy]

    total = len(pts)
    if total == 0:
        return {
            "severity": "low",
            "affected_count": 0,
            "affected_points": [],
            "message": "No known hotspots for selected area.",
            "recommended_actions": ["Monitor rainfall"],
            "rainfall_mm": float(rainfall_mm),
        }

    # map rainfall to fraction of hotspots activated (simple rule)
    if rainfall_mm < 10:
        frac = 0.05
    elif rainfall_mm < 25:
        frac = 0.15
    elif rainfall_mm < 50:
        frac = 0.40
    elif rainfall_mm < 100:
        frac = 0.70
    else:
        frac = 1.0

    affected_count = max(1, int(total * frac))
    # choose deterministic subset: first N (faster & reproducible). You can change to sample()
    affected = pts.iloc[:affected_count]

    out_points = []
    for _, row in affected.iterrows():
        geom = row.geometry
        lat = float(geom.y) if geom is not None else None
        lng = float(geom.x) if geom is not None else None
        props = row_properties_safe(row)
        out_points.append({"lat": lat, "lng": lng, "properties": props})

    severity = classify_severity(rainfall_mm)
    messages = {
        "low": "Low flood risk.",
        "moderate": "Moderate risk — localized hotspots possible.",
        "high": "High risk — many hotspots likely to be affected.",
        "critical": "Critical risk — widespread inundation possible.",
    }
    actions = {
        "low": ["Monitor rainfall trends"],
        "moderate": ["Prepare pumps and alert local teams"],
        "high": ["Issue city-wide advisories", "Mobilize maintenance teams"],
        "critical": ["Activate emergency operations", "Prepare evacuations"],
    }

    return {
        "severity": severity,
        "affected_count": affected_count,
        "affected_points": out_points,
        "message": messages[severity],
        "recommended_actions": actions[severity],
        "rainfall_mm": float(rainfall_mm),
    }

# -------------------------
# Public endpoints
# -------------------------
@app.get("/api/flood/forecast")
def flood_forecast():
    """
    Returns flood prediction for next 24h, 48h, 72h.
    """
    try:
        # city center / default point for Hyderabad
        lat, lng = 17.385, 78.4867
        horizons = {"day1": 24, "day2": 48, "day3": 72}
        out = {}
        for key, hrs in horizons.items():
            rainfall = get_forecast_rainfall(lat, lng, hours=hrs)
            alert = generate_alert_from_rainfall(rainfall)
            out[key] = alert
        return out
    except Exception as e:
        logger.exception("Error in flood_forecast: %s", e)
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.post("/api/disaster/simulate", response_model=ScenarioResponse)
def simulate(req: ScenarioRequest):
    # length & traffic
    length_km = req.approxLength or compute_length_from_points(req.roadPoints)
    lanes = req.lanes or 1
    baseline_minutes = None
    scenario_minutes = None
    minutes_change = 0.0

    if req.origin and req.destination:
        base_sec = compute_od_time(req.origin, req.destination)
        scen_sec = base_sec
        if req.roadPoints and road_graph:
            u = nearest_node(req.roadPoints[0].lat, req.roadPoints[0].lng)
            v = nearest_node(req.roadPoints[-1].lat, req.roadPoints[-1].lng)
            if u is not None and v is not None:
                scen_sec = compute_od_time(req.origin, req.destination, temp_edges=[(u, v, length_km, 60.0)])
        if base_sec is not None and scen_sec is not None:
            baseline_minutes = base_sec / 60.0
            scenario_minutes = scen_sec / 60.0
            minutes_change = scenario_minutes - baseline_minutes
        else:
            minutes_change = -min(20.0, length_km * lanes * 0.6)
            if req.interventionType == "restriction":
                minutes_change = abs(minutes_change) / 2.0

    # flood model (basic)
    baseline_cells = 1000
    baseline_pop = 500_000
    delta_cells = 0
    if flood_points is not None and req.roadPoints:
        line = LineString([(p.lng, p.lat) for p in req.roadPoints])
        road_gdf = gpd.GeoDataFrame(geometry=[line], crs="EPSG:4326")
        road_buffer = road_gdf.to_crs(epsg=3857).buffer(100).to_crs(epsg=4326)
        affected = flood_points[flood_points.within(road_buffer.iloc[0])]
        affected_count = len(affected)
        if req.interventionType == "road":
            delta_cells = +affected_count
        elif req.interventionType == "drain":
            delta_cells = -2 * affected_count
        elif req.interventionType == "green":
            delta_cells = -affected_count
        else:
            delta_cells = -2 * affected_count
    else:
        # fallback length-based
        rf = max(0.01, req.rainfall / 100.0)
        if req.interventionType == "road":
            delta_cells = round(length_km * rf * 10)
        elif req.interventionType == "drain":
            delta_cells = -round(length_km * rf * 15)
        elif req.interventionType == "green":
            delta_cells = -round(length_km * rf * 8)
        else:
            delta_cells = -round(length_km * rf * 12)

    scenario_cells = max(0, baseline_cells + delta_cells)
    scenario_pop = int(baseline_pop * (scenario_cells / baseline_cells))

    notes = f"Intervention length {length_km:.2f} km."

    return ScenarioResponse(
        traffic=TrafficResult(minutesChange=minutes_change, baselineMinutes=baseline_minutes, scenarioMinutes=scenario_minutes),
        flood=FloodResult(baselineHighRiskCells=baseline_cells, scenarioHighRiskCells=scenario_cells, baselinePop=baseline_pop, scenarioPop=scenario_pop),
        notes=notes,
    )

# End of file
