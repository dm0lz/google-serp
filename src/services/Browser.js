const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const { browserOptions } = require("../utils/config");
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
    this.browser = await puppeteer.launch(browserOptions);
    console.log(`Browser initialized for ${this.country}`);
    this.page = await this.browser.newPage();
    this.page.setDefaultNavigationTimeout(180000);
    this.page.setDefaultTimeout(180000);
    console.log(`Page initialized for ${this.country}`);
    await this.page.authenticate({
      username: `customer-${
        process.env.PROXY_USERNAME
      }-cc-${this.country.toUpperCase()}-sessid-${Math.random()
        .toString(36)
        .slice(2)}-sesstime-1440`,
      password: process.env.PROXY_PASSWORD,
    });
    console.log(`proxy authenticated for ${this.country}`);
    await this.page.goto("https://www.google.com/");
    const acceptButton = await this.page.$("#L2AGLb");
    if (acceptButton) {
      await acceptButton.click();
    }
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
    console.log(`${this.country} Captcha Solved`);
    this.isReady = true;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isReady = false;
    }
  }
}

module.exports = Browser;
