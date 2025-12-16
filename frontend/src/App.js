// src/App.js
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Upload from "./pages/Upload";
import Contact from "./pages/Contact";
import DisasterManagement from "./pages/DisasterManagement"; 
import Alerts from "./pages/Alerts";
import UserLogin from "./pages/UserLogin";
import EmployeeLogin from "./pages/EmployeeLogin";


export default function App() {
  return (
    <Router>
      {/* NAVBAR */}
      <AppBar position="static" sx={{ backgroundColor: "#0B3D91" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Digital Twin of India
          </Typography>
          <Button color="inherit" component={Link} to="/">Home</Button>
          <Button color="inherit" component={Link} to="/dashboard">Dashboard</Button>
          <Button color="inherit" component={Link} to="/reports">Reports</Button>
          <Button color="inherit" component={Link} to="/upload">Citizen Upload</Button>
          <Button color="inherit" component={Link} to="/disaster">Disaster Management</Button>
          <Button color="inherit" component={Link} to="/alerts">Alerts</Button>
          <Button color="inherit" component={Link} to="/contact">Contact</Button>
        </Toolbar>
      </AppBar>

      {/* PAGE ROUTES */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/disaster" element={<DisasterManagement />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/user-login" element={<UserLogin />} />
        <Route path="/employee-login" element={<EmployeeLogin />} />

      </Routes>

      {/* FOOTER */}
      <Box
        sx={{
          backgroundColor: "#0B3D91",
          color: "white",
          textAlign: "center",
          py: 2,
          mt: 4,
        }}
      >
        <Typography variant="body2">
          © 2025 National Remote Sensing Centre (NRSC) | Indian Space Research Organisation
        </Typography>
      </Box>
    </Router>
  );
}
