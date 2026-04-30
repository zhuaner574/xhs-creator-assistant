const { chromium } = require("playwright");

const TARGET_URL = "https://creator.xiaohongshu.com/new/inspiration";

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
  });

  console.log("请在浏览器中手动登录。");
  console.log("登录完成后，回到终端按 Enter。");

  process.stdin.once("data", async () => {
    await context.storageState({ path: "auth.json" });
    console.log("登录状态已保存到 auth.json");
    await browser.close();
    process.exit(0);
  });
})();