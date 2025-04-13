const Search = require("../services/Search");
const Browser = require("../services/Browser");
const { countries } = require("../utils/config");

const searchController = (browsers) => {
  return async (req, res) => {
    const { q, token, pages_nb, country } = req.query;
    try {
      if (!country || !countries.includes(country)) {
        return res.status(400).json({
          error:
            "Country parameter 'country' is required and must be one of 'de', 'fr', 'us' or 'es'",
        });
      }
      if (!q) {
        return res
          .status(400)
          .json({ error: "Query parameter 'q' is required" });
      }
      if (!pages_nb) {
        return res
          .status(400)
          .json({ error: "Query parameter 'pages_nb' is required" });
      }
      if (!browsers[country].isReady) {
        return res.status(500).json({
          error: `Browser not initialized for country ${country}`,
        });
      }
      const search = new Search(browsers[country], pages_nb);
      const results = await search.call(q);
      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed", details: error.message });
      try {
        if (browsers[country]) {
          await browsers[country].close();
          console.log(`Browser closed for ${country}`);
        }
        browsers[country] = new Browser(country);
        await browsers[country].init();
      } catch (e) {
        console.error("Browser reinitialization failed:", e);
      }
    }
  };
};

module.exports = { searchController };
