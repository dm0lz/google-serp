const { Mutex } = require("async-mutex");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const { browserOptions, torProxy } = require("../utils/config");
require("dotenv").config();

puppeteer.use(StealthPlugin());
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: process.env.TWO_CAPTCHA_API_KEY,
    },
    visualFeedback: true,
  })
);

class Browser {
  constructor(country) {
    this.country = country;
    this.browser = null;
    this.page = null;
    this.isReady = false;
    this.solvingCaptcha = false;
    this.searchMutex = new Mutex();
    // this.captchaObserver = this.captchaWatch();
  }

  async init() {
    let i = 0;
    while (!this.isReady && i < 5) {
      try {
        await this.setup();
      } catch (error) {
        await this.close();
        console.error("Error initializing browser:", error);
        await this.requestNewIdentity();
        await new Promise((resolve) => setTimeout(resolve, 20000));
      }
      i++;
    }
  }

  async setup() {
    const options = await browserOptions(this.country);
    console.log(options);
    this.browser = await puppeteer.launch(options);
    console.log(`Browser initialized for ${this.country}`);
    this.page = await this.browser.newPage();
    this.page.setDefaultNavigationTimeout(120000);
    this.page.setDefaultTimeout(120000);
    console.log(`Page initialized for ${this.country}`);
    await this.page.exposeFunction(
      "onIframeDetected",
      this.solveCaptcha.bind(this)
    );
    await this.page.goto(
      `https://www.google.${this.country}/?hl=${this.country}`
    );
    await this.page.evaluate(this.injectIframeObserver);
    await this.acceptButton();
    console.log(`fetched google for ${this.country}`);
    await this.page.waitForSelector("textarea");
    await this.googleSubmit("google");
    await this.page.waitForSelector('[role="combobox"]');
    await this.acceptButton();
    if (!this.page.url().includes("search")) {
      await this.googleSubmit("google");
    }
    this.isReady = true;
  }

  async search(query, pages_nb) {
    const release = await this.searchMutex.acquire();
    try {
      await this.page.click(".M2vV3");
      await this.googleSubmit(query);
      const results = [];
      let positionOffset = 0;
      let i = 1;
      while (true) {
        const data = await this.page.evaluate(this.extractData, positionOffset);
        results.push(data);
        positionOffset += data.search_results.length;
        if (!data.next || i >= pages_nb) {
          break;
        }
        const currentUrl = new URL(this.page.url());
        const nextUrl = `https://${currentUrl.hostname}${data.next}`;
        await this.page.goto(nextUrl);
        i++;
      }
      return results;
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    } finally {
      release();
    }
  }

  extractData(positionOffset) {
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
  }

  injectIframeObserver(delay = 500) {
    setTimeout(() => {
      if (document.querySelector("iframe")) {
        window.onIframeDetected();
      }
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (
              node.tagName === "IFRAME" ||
              (node.querySelector && node.querySelector("iframe"))
            ) {
              window.onIframeDetected();
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, delay);
  }

  async solveCaptcha() {
    console.log("Detected iframe");
    if (this._solvingCaptcha) return;
    this._solvingCaptcha = true;
    console.log("Attempting to solve CAPTCHA...");
    try {
      const { captchas, filtered, solutions, solved, error } =
        await this.page.solveRecaptchas();
      console.log("CAPTCHA solve result:", solved);
    } catch (err) {
      console.error("Error solving CAPTCHA:", err);
    } finally {
      this._solvingCaptcha = false;
      console.log("Finished solving CAPTCHA");
      await this.page.evaluate(this.injectIframeObserver, 500);
    }
  }

  async googleSubmit(query) {
    await this.page.type("textarea", query);
    await this.page.keyboard.press("Enter");
    await this.page.waitForNavigation();
    await this.page.evaluate(this.injectIframeObserver);
  }

  // captchaWatch() {
  //   return setInterval(async () => {
  //     if (!this.page) return;
  //     try {
  //       const currentUrl = await this.page.url();
  //       if (currentUrl.includes("sorry")) {
  //         await this.handleRecaptcha();
  //       }
  //     } catch (err) {
  //       console.error("Error in captcha interval:", err);
  //     }
  //   }, 1000);
  // }

  async acceptButton() {
    const acceptButton = await this.page.$("#L2AGLb");
    if (acceptButton) {
      await acceptButton.click();
    }
  }

  async close() {
    // if (this.captchaObserver) {
    //   clearInterval(this.captchaObserver);
    //   this.captchaObserver = null;
    // }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isReady = false;
    }
  }

  async requestNewIdentity() {
    try {
      const res = await fetch(`${torProxy}/newnym/${this.country}`, {
        method: "POST",
      });
      const data = await res.json();
      console.log(`Response for ${this.country}:`, data);
    } catch (err) {
      console.error(`Error requesting newnym for ${this.country}:`, err);
    }
  }

  // async handleRecaptcha(retries = 3) {
  //   if (this.solvingCaptcha) return;
  //   console.log("running handleRecaptcha");
  //   this.solvingCaptcha = true;
  //   try {
  //     await this.page.waitForSelector("iframe");
  //     console.log("running solveRecaptcha");
  //     await Promise.race([
  //       this.page.solveRecaptchas(),
  //       new Promise((_, reject) =>
  //         setTimeout(() => reject(new Error("Timeout")), 60000)
  //       ),
  //     ]);
  //   } catch (err) {
  //     console.error("Error solving CAPTCHA:", err);
  //   } finally {
  //     this.solvingCaptcha = false;
  //     console.log("finished running solveRecaptcha");
  //   }
  // }
}

module.exports = Browser;
