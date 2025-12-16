import { Container, Typography, Box } from "@mui/material";

export default function Contact() {
  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Contact Us
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography><b>National Remote Sensing Centre (NRSC)</b></Typography>
        <Typography>Indian Space Research Organisation (ISRO)</Typography>
        <Typography>Hyderabad, Telangana, India</Typography>
        <Typography>Email: support@nrsc.gov.in</Typography>
        <Typography>Phone: 040-2388 4001</Typography>
      </Box>
    </Container>
  );
}
