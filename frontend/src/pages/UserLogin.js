// src/pages/UserLogin.js
import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

/*
  Simple client-side user auth (demo):
  - Users stored in localStorage key "dt_users" as object { email: { password, digipin, createdAt } }
  - On login we save dt_current_user = { email, digipin }
  NOTE: For production, replace with real auth (Firebase/Auth0/backend).
*/

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem("dt_users") || "{}");
  } catch {
    return {};
  }
}

function saveUsers(obj) {
  localStorage.setItem("dt_users", JSON.stringify(obj));
}

export default function UserLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [digipin, setDigipin] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleRegister = () => {
    setError(""); setInfo("");
    if (!email || !password) { setError("Email and password required"); return; }
    const users = loadUsers();
    if (users[email]) { setError("User already exists. Please login."); return; }
    users[email] = { password, digipin: digipin || "", createdAt: Date.now() };
    saveUsers(users);
    setInfo("Registration successful — you can now login.");
    setMode("login");
  };

  const handleLogin = () => {
    setError(""); setInfo("");
    if (!email || !password) { setError("Email and password required"); return; }
    const users = loadUsers();
    const u = users[email];
    if (!u || u.password !== password) { setError("Invalid credentials"); return; }
    // Save session
    localStorage.setItem("dt_current_user", JSON.stringify({ email, digipin: u.digipin || "" }));
    setInfo("Login successful — redirecting...");
    setTimeout(() => navigate("/"), 600);
  };

  const handleReset = () => {
    setError(""); setInfo("");
    if (!email) { setError("Enter your registered email"); return; }
    const users = loadUsers();
    if (!users[email]) { setError("Email not found"); return; }
    // Demo reset: show password (in production send reset link)
    setInfo(`Demo reset: your password is "${users[email].password}" — do NOT use this in production.`);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Box sx={{ p: 3, borderRadius: 2, boxShadow: 3, background: "white" }}>
        <Typography variant="h5" gutterBottom>
          {mode === "register" ? "Register" : mode === "reset" ? "Reset Password" : "User Login"}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

        {(mode === "login" || mode === "register") && (
          <>
            <TextField fullWidth label="Email" sx={{ mb: 2 }} value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField fullWidth label="Password" type="password" sx={{ mb: 2 }} value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}

        {mode === "register" && (
          <TextField fullWidth label="DIGIPIN (optional)" sx={{ mb: 2 }} value={digipin} onChange={(e) => setDigipin(e.target.value)} />
        )}

        {mode === "reset" && (
          <TextField fullWidth label="Registered email" sx={{ mb: 2 }} value={email} onChange={(e) => setEmail(e.target.value)} />
        )}

        <Box sx={{ display: "flex", gap: 1 }}>
          {mode === "register" ? (
            <>
              <Button variant="contained" onClick={handleRegister}>Create account</Button>
              <Button variant="outlined" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Back to login</Button>
            </>
          ) : mode === "reset" ? (
            <>
              <Button variant="contained" onClick={handleReset}>Reset (demo)</Button>
              <Button variant="outlined" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Back</Button>
            </>
          ) : (
            <>
              <Button variant="contained" onClick={handleLogin}>Login</Button>
              <Button variant="outlined" onClick={() => setMode("register")}>Register</Button>
              <Button sx={{ ml: "auto" }} onClick={() => setMode("reset")}>Forgot?</Button>
            </>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            This demo stores accounts locally. For production replace with a secure authentication backend (Firebase / Auth0 / your API).
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}
