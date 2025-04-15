require("dotenv").config();

const port = 3001;
const torProxy = "http://127.0.0.1:8080";

const browserOptions = async (country) => {
  const proxy = await getProxy(country);
  return process.env.CHROMIUM_FLAGS
    ? {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          ...(process.env.CHROMIUM_FLAGS || "").split(" "),
          `--proxy-server=socks5:${torProxy.split(":")[1]}:${proxy.socks_port}`,
        ],
      }
    : {
        headless: false,
        args: [
          `--proxy-server=socks5:${torProxy.split(":")[1]}:${proxy.socks_port}`,
        ],
      };
};

const getProxy = async (country) => {
  const res = await fetch(`${torProxy}/proxies.json`);
  const proxies = await res.json();
  return proxies[country];
};

const getCountries = async () => {
  const res = await fetch(`${torProxy}/proxies.json`);
  const proxies = await res.json();
  return Object.keys(proxies);
};

module.exports = {
  port,
  getCountries,
  browserOptions,
  torProxy,
};
