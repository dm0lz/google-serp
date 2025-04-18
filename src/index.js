const express = require("express");
const Browser = require("./services/Browser");
const { searchController } = require("./controllers/searchController");
const { port, getCountries } = require("./utils/config");
const gracefulShutdown = require("./utils/gracefulShutdown");

let browsers = {};
const app = express();
app.use(express.json());
app.get("/api/search", searchController(browsers));

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  const countries = await getCountries();
  await Promise.all(
    countries.map(async (country) => {
      browsers[country] = new Browser(country);
      await browsers[country].init();
    })
  );
});

gracefulShutdown(browsers);
