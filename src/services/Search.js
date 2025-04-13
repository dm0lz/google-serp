const { Mutex } = require("async-mutex");

class Search {
  constructor(browser, pages_nb) {
    this.page = browser.page;
    this.pages_nb = pages_nb;
    this.searchMutex = new Mutex();
  }

  async call(query) {
    const release = await this.searchMutex.acquire();
    try {
      await this.page.click(".M2vV3");
      await this.page.type("textarea", query);
      await this.page.keyboard.press("Enter");
      await this.page.waitForNavigation();
      const results = [];
      let positionOffset = 0;
      while (true) {
        const data = await this.page.evaluate(this.extractData, positionOffset);
        results.push(data);
        positionOffset += data.search_results.length;
        if (!data.next || positionOffset / 10 >= this.pages_nb) {
          break;
        }
        await this.page.goto("https://www.google.com" + data.next);
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
}

module.exports = Search;
