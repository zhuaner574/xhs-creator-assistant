const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TARGET_URL = "https://creator.xiaohongshu.com/new/inspiration";
const TABS = ["美食", "美妆", "时尚", "出行", "知识", "兴趣爱好"];

(async () => {
  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext({
    storageState: "auth.json",
  });

  const page = await context.newPage();

  await page.goto(TARGET_URL, {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  console.log("请确认页面已经进入「笔记灵感 / 经典话题」页面。");
  console.log("如果没有，请在弹出的浏览器里手动点到该页面。");
  console.log("完成后回到终端按 Enter。");

  await new Promise(resolve => process.stdin.once("data", resolve));

  const results = [];

  for (const tabName of TABS) {
    try {
      console.log(`正在抓取：${tabName}`);

      await page.getByText(tabName, { exact: true }).click();
      await page.waitForTimeout(3000);

      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(2000);

      const rawText = await page.locator("body").innerText();

      results.push({
        category: tabName,
        rawText,
        scrapedAt: new Date().toISOString(),
      });

      console.log(`${tabName} 完成`);
    } catch (error) {
      console.log(`${tabName} 抓取失败：${error.message}`);
    }
  }

  const outputDir = path.join(__dirname, "outputs");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(
    path.join(outputDir, "raw-hotwords.json"),
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("全部完成，已保存到 outputs/raw-hotwords.json");

  await browser.close();
})();