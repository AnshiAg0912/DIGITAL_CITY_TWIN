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
