const express = require("express");
const { Mutex } = require("async-mutex");
const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const countries = ["us", "fr", "de", "es"];
// require("dotenv").config();
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: process.env.TWO_CAPTCHA_API_KEY,
    },
    visualFeedback: true,
  })
);
puppeteer.use(StealthPlugin());
const run_script = (positionOffset) => {
  return {
    next: document.querySelector("#pnnext")?.getAttribute("href"),
    serp_url: document.location.href,
    search_results: [...document.querySelectorAll("[data-snc]")].map(
      (article, index) => ({
        site_name:
          article
            .querySelector("div.notranslate > div > div > div")
            ?.textContent?.trim() || "N/A",
        url: article.querySelector("a")?.getAttribute("href") || "N/A",
        title: article.querySelector("a > h3")?.textContent?.trim() || "N/A",
        description:
          article.querySelector("[data-sncf]")?.textContent?.trim() || "N/A",
        position: positionOffset + index + 1,
      })
    ),
  };
};
const searchMutex = new Mutex();
const search = async (page, query, pages_nb) => {
  const release = await searchMutex.acquire();
  try {
    const selector = ".M2vV3";
    if (await page.$(selector)) {
      await page.click(selector);
    }
    await page.type("textarea", query);
    await page.keyboard.press("Enter");
    await page.waitForNavigation();
    const results = [];
    let positionOffset = 0;
    while (true) {
      const data = await page.evaluate(run_script, positionOffset);
      results.push(data);
      positionOffset += data.search_results.length;
      if (!data.next || positionOffset / 10 >= pages_nb) {
        break;
      }
      await page.goto("https://www.google.com" + data.next);
    }
    return results;
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  } finally {
    release();
  }
};
let browsers = {};
let pages = {};
const initBrowser = async (country) => {
  browsers[country] = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      ...process.env.CHROMIUM_FLAGS.split(" "),
      `--proxy-server=${process.env.PROXY_SERVER}`,
    ],
  });
  console.log(`Browser initialized for ${country}`);
  pages[country] = await browsers[country].newPage();
  pages[country].setDefaultNavigationTimeout(180000);
  pages[country].setDefaultTimeout(180000);
  console.log(`Page initialized for ${country}`);
  await pages[country].authenticate({
    username: `customer-${
      process.env.PROXY_USERNAME
    }-cc-${country.toUpperCase()}-sessid-${Math.random()
      .toString(36)
      .slice(2)}-sesstime-1440`,
    password: process.env.PROXY_PASSWORD,
  });
  console.log(`proxy authenticated for ${country}`);
  await pages[country].goto("https://www.google.com/");
  const acceptButton = await pages[country].$("#L2AGLb");
  if (acceptButton) {
    await acceptButton.click();
  }
  console.log(`fetched google for ${country}`);
  await pages[country].waitForSelector("textarea");
  await pages[country].type("textarea", "google");
  await pages[country].keyboard.press("Enter");
  console.log(`Solving ${country} Captcha`);
  await pages[country].waitForSelector("iframe");
  const { captchas, filtered, solutions, solved, error } = await pages[
    country
  ].solveRecaptchas();
  await pages[country].waitForSelector('[role="combobox"]');
  console.log(`${country} Captcha Solved`);
  if (await pages[country].$("iframe")) {
    await pages[country].solveRecaptchas();
  }
};
const app = express();
app.use(express.json());
app.get("/api/search", async (req, res) => {
  const { q, token, pages_nb, country } = req.query;
  try {
    if (!country || !countries.includes(country)) {
      return res.status(400).json({
        error:
          "Country parameter 'country' is required and must be one of 'de', 'fr', or 'us'",
      });
    }
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    if (!pages_nb) {
      return res
        .status(400)
        .json({ error: "Query parameter 'pages_nb' is required" });
    }
    const results = await search(pages[country], q, pages_nb);
    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
    try {
      if (browsers[country]) await browsers[country].close();
      await initBrowser(country);
    } catch (e) {
      console.error("Browser reinitialization failed:", e);
    }
  }
});
process.on("SIGTERM", async () => {
  for (const browser of Object.values(browsers)) {
    await browser.close();
  }
  process.exit(0);
});
const PORT = 3001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await Promise.all(
    countries.map(async (country) => {
      await initBrowser(country);
    })
  );
});
