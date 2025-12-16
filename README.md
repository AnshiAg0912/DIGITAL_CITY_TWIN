# DIGITAL_CITY_TWIN
This project develops a digital twin of Hyderabad that integrates real-time environmental, infrastructure, and citizen-generated data into a single intelligent dashboard. It enables advanced analytics, disaster simulations, and geospatial issue reporting to support smart city decision-making.

Tech Stack
Frontend
React.js
Material UI
Leaflet & React-Leaflet
Recharts
JavaScript

Backend
FastAPI (Python)
Uvicorn
GeoPandas
OSMnx
NetworkX
Shapely

External APIs
OpenStreetMap
Open-Meteo
OpenAQ

PROJECT STRUCTURE:
DIGITAL_TWIN_CITY/
│
├── backend/
│   ├── main.py
│   ├── data/
│   │   └── hyd_flood_points.geojson
│   └── requirements / conda env
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.js
│   │   │   ├── DisasterManagement.js
│   │   │   ├── Alerts.js
│   │   │   ├── Reports.js
│   │   │   ├── Upload.js
│   │   │   └── Contact.js
│   │   ├── App.js
│   │   └── index.js
│
├── public/
│   └── hyd_flood_points.geojson
│
└── README.md

BACKEND SETUP:
1. Install python
2. Verify Python Installation
python --version
pip --version
3.Create Backend Folder
cd Desktop
mkdir DIGITAL_CITY_TWIN
cd DIGITAL_CITY_TWIN
mkdir backend
cd backend
4.Create Virtual Environment:
Create environment(venv):
python -m venv venv
Activate venv:
venv\Scripts\activate
5.Upgrade pip:
pip install --upgrade pip
6. Install all these librariesin backend folder:
   pip install fastapi uvicorn
   pip install python-multipart pydantic
   pip install geopandas shapely pyproj fiona
   pip install osmnx networkx
   pip install requests
7.## Large Data Files
GraphML is excluded from this repository due to GitHub size limits.
It must be generated separately.
8. Steps to generate build_graph.py
   a. Create build_graph.py in venv folder in backend:
      # backend/build_graph.py

import osmnx as ox
import networkx as nx

# Download driving network for Hyderabad bounding box
# You can adjust the place name if needed
place = "Hyderabad, Telangana, India"

print("Downloading road network for:", place)
G = ox.graph_from_place(place, network_type="drive")

# Add edge speeds and travel times
G = ox.add_edge_speeds(G)       # km/h
G = ox.add_edge_travel_times(G) # seconds

# Save to disk (GraphML is easy to reload)
output_path = "data/hyd_road_graph.graphml"
ox.save_graphml(G, output_path)

print("Saved graph to:", output_path)
print("Nodes:", len(G.nodes), "Edges:", len(G.edges))
  b.in terminal run:
    python build_graph.py
  c.Create requirements.txt
    Run:
    pip freeze > requirements.txt
    and then:
    pip install -r requirements.txt
9.Starting backend:
 Activate venv:
 venv\Scripts\activate
Running backend:
uvicorn main:app --reload
Backend Running At:
http://localhost:8000
    



   
   

