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
  }

  async init() {
    let i = 0;
    while (!this.isReady && i < 3) {
      try {
        await this.setup();
      } catch (error) {
        await this.close();
        console.error("Error initializing browser:", error);
        await this.requestNewIdentity();
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
      `https://www.google.${this.country}/?hl=${this.country}`
    );
    await this.acceptButton();
    console.log(`fetched google for ${this.country}`);
    await this.page.waitForSelector("textarea");
    await this.page.type("textarea", "google");
    await this.page.keyboard.press("Enter");
    console.log(`Solving ${this.country} Captcha`);
    await this.page.waitForSelector("iframe");
    const { captchas, filtered, solutions, solved, error } =
      await this.page.solveRecaptchas();
    await this.page.waitForSelector('[role="combobox"]');
    if (await this.page.$("iframe")) {
      await this.page.solveRecaptchas();
    }
    await this.acceptButton();
    console.log(`${this.country} Captcha Solved`);
    if (!this.page.url().includes("search")) {
      await this.page.type("textarea", "google");
      await this.page.keyboard.press("Enter");
      await this.page.waitForNavigation();
    }
    if (await this.page.$("iframe")) {
      await this.page.solveRecaptchas();
    }
    this.isReady = true;
  }

  async acceptButton() {
    const acceptButton = await this.page.$("#L2AGLb");
    if (acceptButton) {
      await acceptButton.click();
    }
  }

  async close() {
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
}

module.exports = Browser;
