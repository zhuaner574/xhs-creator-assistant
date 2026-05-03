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

const hotwordsPath = path.join(__dirname, "outputs", "hotwords-ai.json");
const profilePath = path.join(__dirname, "creator-profile.json");
const outputPath = path.join(__dirname, "outputs", "daily-feishu-ideas.json");
const rawErrorPath = path.join(__dirname, "outputs", "daily-generate-raw-error.txt");

function readJsonFile(filePath, name) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${name} 不存在：${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    throw new Error(`${name} 不是合法 JSON：${error instanceof Error ? error.message : "未知错误"}`);
  }
}

function normalizeIdea(item, index) {
  const score = Number(item?.matchScore ?? item?.score ?? 0);
  const outlineRaw = item?.outline;
  return {
    rank: Number(item?.rank) || index + 1,
    hotword: String(item?.hotword ?? item?.keyword ?? "热点词"),
    matchScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    title: String(item?.title ?? item?.topicTitle ?? "未返回标题"),
    angle: String(item?.angle ?? "内容切入点待补充"),
    outline: Array.isArray(outlineRaw)
      ? outlineRaw.map((x) => String(x))
      : String(outlineRaw ?? "暂无大纲")
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean),
    coverText: String(item?.coverText ?? "封面文案待补充"),
    whyItFits: String(item?.whyItFits ?? "与创作者画像匹配"),
    suggestedPostTime: String(item?.suggestedPostTime ?? "20:00"),
  };
}

async function main() {
  const hotwords = readJsonFile(hotwordsPath, "hotwords-ai.json");
  if (!Array.isArray(hotwords) || hotwords.length === 0) {
    throw new Error("hotwords-ai.json 为空或格式错误：需要非空数组。");
  }

  const creatorProfile = readJsonFile(profilePath, "creator-profile.json");
  const hotwordPayload = hotwords.slice(0, 80);

  const prompt = `
你是专业的小红书选题策划助手。

创作者画像：
${JSON.stringify(creatorProfile, null, 2)}

今日真实热点数据：
${JSON.stringify(hotwordPayload, null, 2)}

请基于以上信息，生成 5 条最适合“今天发布”的小红书选题。

输出规则（必须严格遵守）：
1) 输出必须是严格 JSON，不要 Markdown，不要解释。
2) 顶层必须是对象，格式为：
{
  "ideas": [
    {
      "rank": 1,
      "hotword": "",
      "matchScore": 90,
      "title": "",
      "angle": "",
      "outline": [],
      "coverText": "",
      "whyItFits": "",
      "suggestedPostTime": ""
    }
  ]
}
3) 不要在字符串中使用换行，所有字段值必须是单行字符串。
4) outline 必须是字符串数组，不能写成包含换行的大段字符串。
`;

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });

  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const content = response?.choices?.[0]?.message?.content || "";

  let ideasRaw;
  try {
    const parsed = JSON.parse(content);
    ideasRaw = parsed?.ideas;
    if (!Array.isArray(ideasRaw)) {
      throw new Error("JSON object does not contain ideas array");
    }
  } catch (error) {
    console.error("DeepSeek 原始输出：");
    console.error(content);
    fs.writeFileSync(rawErrorPath, `${String(content || "")}\n`, "utf-8");
    throw new Error(
      `DeepSeek 返回不是标准 JSON：${error instanceof Error ? error.message : "未知错误"}`
    );
  }

  const ideas = ideasRaw.slice(0, 5).map((item, idx) => normalizeIdea(item, idx));
  fs.writeFileSync(outputPath, `${JSON.stringify(ideas, null, 2)}\n`, "utf-8");

  console.log(`选题生成完成，共 ${ideas.length} 条`);
  console.log(`已保存到 ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "生成失败");
  process.exit(1);
});
