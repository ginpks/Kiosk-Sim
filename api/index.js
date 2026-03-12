const express = require("express");

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/", (_req, res) => {
  res.send("Campus kiosk API is running.");
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
