const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  throw new Error("Missing DEEPSEEK_API_KEY. 请检查根目录 .env 文件。");
}

const inputPath = path.join(__dirname, "outputs", "raw-hotwords.json");
const outputPath = path.join(__dirname, "outputs", "hotwords-ai.json");

function readInput() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`未找到输入文件：${inputPath}`);
  }
  const raw = fs.readFileSync(inputPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("raw-hotwords.json 格式错误：应为数组。");
  }
  return parsed;
}

function extractJsonArray(text) {
  const cleaned = String(text || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function main() {
  const input = readInput();
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });

  const merged = [];

  for (const item of input) {
    const category = String(item?.category || "");
    const rawText = String(item?.rawText || "");

    if (!category || !rawText.trim()) {
      continue;
    }

    const prompt = `
你是小红书热点提取助手。

请从以下原始文本中提取该分类下的热点话题，并输出严格 JSON 数组。

分类：${category}
原始文本：
${rawText}

输出要求：
1) 只输出 JSON 数组，不要 markdown，不要解释。
2) 每个元素字段必须为：
   - category
   - topic
   - participation
   - views
3) category 固定为 "${category}"。

示例：
[
  {
    "category": "${category}",
    "topic": "某热点话题",
    "participation": "12.3万讨论",
    "views": "3.1亿浏览"
  }
]
`;

    let content = "";
    try {
      const response = await client.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });
      content = response?.choices?.[0]?.message?.content || "";
    } catch (error) {
      console.error(`调用 DeepSeek 失败（category=${category}）：`, error);
      continue;
    }

    let extracted = [];
    try {
      extracted = extractJsonArray(content);
    } catch (error) {
      console.error(`AI 输出不是标准 JSON，跳过 category=${category}`);
      console.error("原始内容：");
      console.error(content);
      continue;
    }

    if (!Array.isArray(extracted)) continue;

    for (const row of extracted) {
      merged.push({
        category: String(row?.category || category),
        topic: String(row?.topic || ""),
        participation: String(row?.participation || ""),
        views: String(row?.views || ""),
      });
    }
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  console.log(`AI 提取完成，共 ${merged.length} 条，已保存到 ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ai-extract 执行失败");
  process.exit(1);
});
