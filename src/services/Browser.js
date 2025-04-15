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
    this.captchaObserver = this.captchaWatch();
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
        await new Promise((resolve) => setTimeout(resolve, 30000));
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
    this.page.setDefaultNavigationTimeout(180000);
    this.page.setDefaultTimeout(180000);
    console.log(`Page initialized for ${this.country}`);
    await this.page.goto(
      `https://www.google.${this.country}/?hl=${this.country}`,
      { waitUntil: "domcontentloaded" }
    );
    await this.acceptButton();
    console.log(`fetched google for ${this.country}`);
    await this.page.waitForSelector("textarea");
    await this.googleSubmit();
    await this.page.waitForSelector('[role="combobox"]');
    await this.acceptButton();
    if (!this.page.url().includes("search")) {
      await this.googleSubmit();
    }
    this.isReady = true;
  }

  async googleSubmit() {
    await this.page.type("textarea", "google");
    await this.page.keyboard.press("Enter");
    await this.page.waitForNavigation();
  }

  captchaWatch() {
    return setInterval(async () => {
      if (!this.page) return;
      try {
        const currentUrl = await this.page.url();
        if (currentUrl.includes("sorry")) {
          await this.handleRecaptcha();
        }
      } catch (err) {
        console.error("Error in captcha interval:", err);
      }
    }, 1000);
  }

  async acceptButton() {
    const acceptButton = await this.page.$("#L2AGLb");
    if (acceptButton) {
      await acceptButton.click();
    }
  }

  async close() {
    if (this.captchaObserver) {
      clearInterval(this.captchaObserver);
      this.captchaObserver = null;
    }
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

  async handleRecaptcha(retries = 3) {
    if (this.solvingCaptcha) return;
    this.solvingCaptcha = true;
    try {
      console.log("running solveRecaptcha");
      await Promise.race([
        this.page.solveRecaptchas(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 60000)
        ),
      ]);
    } catch (err) {
      console.error("Error solving CAPTCHA:", err);
    } finally {
      this.solvingCaptcha = false;
      console.log("finished running solveRecaptcha");
    }
  }
}

module.exports = Browser;
