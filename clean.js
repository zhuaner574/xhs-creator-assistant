const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "outputs", "raw-hotwords.json");
const outputPath = path.join(__dirname, "outputs", "hotwords.json");

const rawData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

const hotwords = [];

for (const item of rawData) {
  const text = item.rawText;

  const regex = /#\s*([^\n#]+?)(?:\n|$)([\s\S]*?)(?=#\s*[^\n#]+|\n首页|\n笔记管理|$)/g;

  let match;

  while ((match = regex.exec(text)) !== null) {
    const keyword = match[1].trim();
    const nearbyText = match[2] || "";

    const participationMatch = nearbyText.match(/[\d.]+万?人参与/);
    const viewsMatch = nearbyText.match(/[\d.]+[万亿]?次浏览/);

    if (
      keyword &&
      keyword.length <= 30 &&
      !keyword.includes("发布笔记") &&
      !keyword.includes("首页")
    ) {
      hotwords.push({
        category: item.category,
        keyword,
        participation: participationMatch ? participationMatch[0] : null,
        views: viewsMatch ? viewsMatch[0] : null,
      });
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify(hotwords, null, 2), "utf-8");

console.log(`清洗完成，共提取 ${hotwords.length} 个热点词`);
console.log(`已保存到 ${outputPath}`);