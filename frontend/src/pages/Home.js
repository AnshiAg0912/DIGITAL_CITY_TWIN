import { Box, Typography, Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";

export default function Home() {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleLoginClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const goToUserLogin = () => {
    handleClose();
    window.location.href = "/user-login";   // route for normal users
  };

  const goToEmployeeLogin = () => {
    handleClose();
    window.location.href = "/employee-login"; // route for employees/admins
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        backgroundImage: `url("/map.jfif")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        color: "white",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.3)",
          zIndex: 1,
        }}
      />

      <Box sx={{ zIndex: 2, padding: 2 }}>
        <Typography
          variant="h3"
          fontWeight="bold"
          gutterBottom
          sx={{ textShadow: "2px 2px 6px rgba(0,0,0,0.4)" }}
        >
          Welcome to the Digital Twin of India
        </Typography>

        <Typography
          variant="h6"
          maxWidth="700px"
          sx={{
            margin: "0 auto",
            textShadow: "1px 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          A unified digital visualization of India’s infrastructure,
          environment, and geospatial data — enabling real-time insights.
        </Typography>

        {/* LOGIN BUTTON */}
        <Button
          variant="contained"
          onClick={handleLoginClick}
          sx={{
            backgroundColor: "#FF9933",
            color: "white",
            marginTop: 4,
            paddingX: 4,
            paddingY: 1.2,
            fontSize: "1rem",
            fontWeight: "bold",
            borderRadius: "25px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            "&:hover": { backgroundColor: "#E67E22" },
          }}
        >
          Login
        </Button>

        {/* LOGIN OPTIONS MENU */}
        <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
          <MenuItem onClick={goToUserLogin}>User Login</MenuItem>
          <MenuItem onClick={goToEmployeeLogin}>Employee Login</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
