const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const fs = require("fs");
const OpenAI = require("openai");

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error("Missing DEEPSEEK_API_KEY. 请检查 xhs-hotword-bot/.env 文件。");
}

const client = new OpenAI({
  apiKey,
  baseURL: "https://api.deepseek.com",
});

const hotwordsPath = path.join(__dirname, "outputs", "hotwords-ai.json");
const profilePath = path.join(__dirname, "creator-profile.json");
const outputPath = path.join(__dirname, "outputs", "daily-ideas.json");

const hotwords = JSON.parse(fs.readFileSync(hotwordsPath, "utf-8"));
const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));

function normalizeIdea(idea, index) {
  const rank = Number(idea?.rank);
  const matchScore = Number(idea?.matchScore ?? idea?.score ?? 0);
  const outlineRaw = idea?.outline;

  return {
    rank: Number.isFinite(rank) ? rank : index + 1,
    hotword: String(idea?.hotword ?? idea?.hotwordUsed ?? idea?.keyword ?? "热点词"),
    matchScore: Number.isFinite(matchScore) ? Math.max(0, Math.min(100, Math.round(matchScore))) : 0,
    title: String(idea?.title ?? idea?.topicTitle ?? idea?.titleText ?? "未返回标题"),
    angle: String(idea?.angle ?? "内容切入点待补充"),
    outline: Array.isArray(outlineRaw)
      ? outlineRaw.map((item) => String(item))
      : String(outlineRaw ?? "暂无大纲")
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean),
    coverText: String(idea?.coverText ?? "封面文案待补充"),
    whyItFits: String(idea?.whyItFits ?? "与创作者画像匹配"),
  };
}

async function generateIdeas() {
  const structuredProfile = profile?.structuredProfile || profile || {};
  const freeformInfo = profile?.freeformInfo || "";

  const prompt = `
你是一个专业的小红书内容策划助手。

你将基于以下信息生成今日选题：

【结构化创作者画像 structuredProfile】
${JSON.stringify(structuredProfile, null, 2)}

【自由补充信息 freeformInfo】
${freeformInfo}

下面是今天抓取到的小红书热点词：

${JSON.stringify(hotwords.slice(0, 80), null, 2)}

请严格按以下两阶段执行（先做阶段A，再做阶段B）：

阶段A：先从 freeformInfo 提取创作者画像维度
- identityTags
- nicheTags
- audienceTags
- styleTags
- titlePatterns
- contentAssets
- avoidTopics

阶段B：结合 structuredProfile + 阶段A提取结果 + 今日热点词，生成 10 个最适合今天发布的小红书选题
- 不要机械套热点，要考虑赛道、受众、人设、风格和可执行性
- 标题要像小红书真实爆款标题，不要太官方
- 内容方向必须具体，可落地
- 每个选题都要写 whyItFits，解释“为什么匹配这个账号”
- 输出必须是严格 JSON，不要 Markdown，不要额外解释

输出格式：

{
  "extractedProfile": {
    "identityTags": ["..."],
    "nicheTags": ["..."],
    "audienceTags": ["..."],
    "styleTags": ["..."],
    "titlePatterns": ["..."],
    "contentAssets": ["..."],
    "avoidTopics": ["..."]
  },
  "ideas": [
    {
      "rank": 1,
      "hotword": "热点词",
      "matchScore": 92,
      "title": "小红书标题",
      "angle": "内容切入点",
      "outline": [
        "开头钩子",
        "核心观点1",
        "核心观点2",
        "个人经验/案例",
        "结尾互动"
      ],
      "coverText": "封面文案",
      "whyItFits": "为什么适合这个创作者"
    }
  ]
}
`;

  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  const content = response.choices[0].message.content.trim();

  try {
    const parsed = JSON.parse(content);
    const rawIdeas = Array.isArray(parsed) ? parsed : parsed?.ideas;
    if (!Array.isArray(rawIdeas)) {
      throw new Error("AI 返回数据缺少 ideas 数组");
    }

    const ideas = rawIdeas.slice(0, 10).map((item, index) => normalizeIdea(item, index));

    fs.writeFileSync(outputPath, JSON.stringify(ideas, null, 2), "utf-8");

    console.log(`选题生成完成，共 ${ideas.length} 个`);
    console.log(`已保存到 ${outputPath}`);
  } catch (error) {
    console.log("AI 输出不是标准 JSON：");
    console.log(content);
  }
}

generateIdeas();