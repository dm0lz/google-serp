const express = require("express");
const { Mutex } = require("async-mutex");
const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
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
    search_results: [
      ...document.querySelectorAll("#search > div > div > div"),
    ].map((article, index) => ({
      site_name:
        article
          .querySelector(
            "div > div > div > div > div > div > div > div > div > div > div > div > div > div > div > div > div > div > div"
          )
          ?.textContent?.trim() || "N/A",
      url:
        article
          .querySelector(
            "div > div > div > div > div > div > div > div > div > div > div > div > div > div > span > a"
          )
          ?.getAttribute("href") || "N/A",
      title:
        article
          .querySelector(
            "div > div > div > div > div > div > div > div > div > div > div > div > div > div > span > a > h3"
          )
          ?.textContent?.trim() || "N/A",
      description:
        article
          .querySelectorAll(
            "div > div > div > div > div > div > div > div > div > div > div"
          )
          [
            article.querySelectorAll(
              "div > div > div > div > div > div > div > div > div > div > div"
            ).length - 1
          ]?.textContent?.trim() || "N/A",
      position: positionOffset + index + 1,
    })),
  };
};
const searchMutex = new Mutex();
const search = async (page, query) => {
  const release = await searchMutex.acquire();
  try {
    await page.click(".M2vV3");
    await page.type("textarea", query);
    await page.keyboard.press("Enter");
    await page.waitForNavigation();
    const results = [];
    let positionOffset = 0;
    while (true) {
      const data = await page.evaluate(run_script, positionOffset);
      results.push(data);
      positionOffset += data.search_results.length;
      if (!data.next || positionOffset / 10 >= 3) {
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
let browser;
let page;
const initBrowser = async () => {
  try {
    browser = await puppeteer.launch({
      headless: true,
      slowMo: 50,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: process.env.CHROMIUM_FLAGS.split(" "),
    });
    page = await browser.newPage();
    await page.goto("https://www.google.com/");
    await page.click("#L2AGLb");
    await page.type("textarea", "arioz");
    await page.keyboard.press("Enter");
    console.log("Solving Captcha");
    await page.waitForSelector("iframe");
    const { captchas, filtered, solutions, solved, error } =
      await page.solveRecaptchas();
    await page.waitForNavigation();
    console.log("Captcha Solved");
    return { browser, page };
  } catch (error) {
    console.log("Browser initialization failed:", error);
  }
};
const app = express();
app.use(express.json());
app.get("/api/search", async (req, res) => {
  try {
    const { q, token } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    const results = await search(page, q);
    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
    try {
      if (browser) await browser.close();
      await initBrowser();
    } catch (e) {
      console.error("Browser reinitialization failed:", e);
    }
  }
});
process.on("SIGTERM", async () => {
  if (browser) await browser.close();
  process.exit(0);
});
const PORT = 3001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initBrowser();
});
