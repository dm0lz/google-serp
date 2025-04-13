const express = require("express");
const Browser = require("./services/Browser");
const { searchController } = require("./controllers/searchController");
const { port, countries } = require("./utils/config");
const gracefulShutdown = require("./utils/gracefulShutdown");
require("dotenv").config();

let browsers = {};
const app = express();
app.use(express.json());
app.get("/api/search", searchController(browsers));

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  await Promise.all(
    countries.map(async (country) => {
      browsers[country] = new Browser(country);
      await browsers[country].init();
    })
  );
});

gracefulShutdown(browsers);
