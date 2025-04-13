require("dotenv").config();

const port = 3001;
const countries = ["es", "fr"];
const browserOptions = process.env.CHROMIUM_FLAGS
  ? {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        ...(process.env.CHROMIUM_FLAGS || "").split(" "),
        `--proxy-server=${process.env.PROXY_SERVER}`,
      ],
    }
  : {
      headless: false,
      args: [`--proxy-server=${process.env.PROXY_SERVER}`],
    };
console.log(browserOptions);

module.exports = {
  port,
  countries,
  browserOptions,
};
