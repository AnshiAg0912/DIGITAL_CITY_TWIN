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
