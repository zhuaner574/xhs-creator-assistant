const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "outputs", "hotwords-ai.json");
const targetDir = path.join(__dirname, "xhs-creator-frontend", "public", "data");
const targetPath = path.join(targetDir, "hotwords.json");

function syncHotwords() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const content = fs.readFileSync(sourcePath, "utf-8");
  fs.writeFileSync(targetPath, content, "utf-8");

  console.log("热点数据已同步到前端 public/data/hotwords.json");
}

try {
  syncHotwords();
} catch (error) {
  console.error(error instanceof Error ? error.message : "同步热点数据失败");
  process.exit(1);
}
