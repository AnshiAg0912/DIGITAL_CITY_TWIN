// src/pages/EmployeeLogin.js
import React, { useState, useEffect } from "react";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

/*
  Employee (admin) login demo:
  - Whitelisted admin emails in ADMIN_EMAILS
  - Auth checks local users list for password (demo only)
  - Admin panel displays users (dt_users) and uploads (dt_uploads) and allows CSV export
*/

const ADMIN_EMAILS = ["admin@example.com", "employee@city.gov"]; // change to your admin emails

function loadUsers() {
  try { return JSON.parse(localStorage.getItem("dt_users") || "{}"); } catch { return {}; }
}
function loadUploads() {
  try { return JSON.parse(localStorage.getItem("dt_uploads") || "[]"); } catch { return []; }
}

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState({});
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    setUsers(loadUsers());
    setUploads(loadUploads());
    const a = localStorage.getItem("dt_is_admin");
    setIsAdmin(a === "1");
  }, []);

  const handleLogin = () => {
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    if (!ADMIN_EMAILS.includes(email)) { setError("Not an admin email"); return; }
    const u = loadUsers()[email];
    if (!u || u.password !== password) { setError("Invalid credentials"); return; }
    localStorage.setItem("dt_is_admin", "1");
    localStorage.setItem("dt_current_admin", JSON.stringify({ email, loggedAt: Date.now() }));
    setIsAdmin(true);
  };

  const logout = () => {
    localStorage.removeItem("dt_is_admin");
    localStorage.removeItem("dt_current_admin");
    setIsAdmin(false);
  };

  // CSV helpers
  const downloadCSV = (rows, filename = "export.csv") => {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportUsers = () => {
    const u = loadUsers();
    const rows = [["email","digipin","createdAt"]];
    Object.entries(u).forEach(([email, v]) => rows.push([email, v.digipin||"", new Date(v.createdAt).toISOString()]));
    downloadCSV(rows, "users_export.csv");
  };

  const exportUploads = () => {
    const ups = loadUploads();
    const rows = [["email","digipin","category","description","timestamp","ip","extra"]];
    ups.forEach(u => rows.push([u.email||"", u.digipin||"", u.category||"", u.description||"", new Date(u.ts||0).toISOString(), u.ip||"", JSON.stringify(u.extra||{})]));
    downloadCSV(rows, "uploads_export.csv");
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 6 }}>
      {!isAdmin ? (
        <Box sx={{ p:3, boxShadow:3, borderRadius:2, background:"white" }}>
          <Typography variant="h5" gutterBottom>Employee / Admin Login</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Admin email" sx={{ mb:2 }} value={email} onChange={(e)=>setEmail(e.target.value)} />
          <TextField fullWidth label="Password" type="password" sx={{ mb:2 }} value={password} onChange={(e)=>setPassword(e.target.value)} />
          <Box sx={{ display:"flex", gap:2 }}>
            <Button variant="contained" onClick={handleLogin}>Login as Admin</Button>
            <Button variant="outlined" onClick={()=>navigate("/")}>Cancel</Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display:"block", mt:2 }}>
            Admin emails whitelist: {ADMIN_EMAILS.join(", ")} (change in code)
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:2 }}>
            <Typography variant="h5">Admin Dashboard</Typography>
            <Box>
              <Button variant="outlined" sx={{ mr:1 }} onClick={exportUsers}>Export Users CSV</Button>
              <Button variant="outlined" sx={{ mr:1 }} onClick={exportUploads}>Export Uploads CSV</Button>
              <Button variant="contained" color="error" onClick={logout}>Logout</Button>
            </Box>
          </Box>

          <Divider sx={{ mb:2 }} />

          <Typography variant="h6" sx={{ mb:1 }}>Registered Users</Typography>
          <Table size="small" sx={{ mb:3 }}>
            <TableHead>
              <TableRow><TableCell>Email</TableCell><TableCell>DIGIPIN</TableCell><TableCell>Created</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(users).length === 0 && <TableRow><TableCell colSpan={3}>No users</TableCell></TableRow>}
              {Object.entries(users).map(([email, u]) => (
                <TableRow key={email}>
                  <TableCell>{email}</TableCell>
                  <TableCell>{u.digipin || "—"}</TableCell>
                  <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="h6" sx={{ mb:1 }}>Citizen Uploads</Typography>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>When</TableCell><TableCell>User</TableCell><TableCell>Category</TableCell><TableCell>DIGIPIN</TableCell><TableCell>Description</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {uploads.length === 0 && <TableRow><TableCell colSpan={5}>No uploads</TableCell></TableRow>}
              {uploads.slice().reverse().map((u, idx) => (
                <TableRow key={idx}>
                  <TableCell>{u.ts ? new Date(u.ts).toLocaleString() : "—"}</TableCell>
                  <TableCell>{u.email || "anonymous"}</TableCell>
                  <TableCell>{u.category || "—"}</TableCell>
                  <TableCell>{u.digipin || "—"}</TableCell>
                  <TableCell>{u.description || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Container>
  );
}
