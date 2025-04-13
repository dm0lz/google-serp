const gracefulShutdown = (browsers) => {
  const shutdown = async () => {
    console.log(
      `Shutting down gracefully ${Object.values(browsers).length} browsers`
    );
    await Promise.all(
      Object.values(browsers).map(async (browser) => {
        try {
          await browser.close();
          console.log("Browser closed.");
        } catch (err) {
          console.error("Error closing browser:", err);
        }
      })
    );
    console.log("All browsers closed. Exiting.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", async (err) => {
    console.error("Uncaught Exception:", err);
    await shutdown();
  });

  process.on("unhandledRejection", async (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    await shutdown();
  });

  process.on("exit", (code) => {
    console.log(`Process exiting with code: ${code}`);
  });

  return shutdown;
};

module.exports = gracefulShutdown;
