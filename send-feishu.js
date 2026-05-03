const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
const ideasPath = path.join(__dirname, "outputs", "daily-feishu-ideas.json");

function readIdeas() {
  if (!fs.existsSync(ideasPath)) {
    throw new Error(`未找到选题文件：${ideasPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(ideasPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `daily-feishu-ideas.json 不是合法 JSON：${error instanceof Error ? error.message : "未知错误"}`
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("daily-feishu-ideas.json 为空或格式错误（需要非空数组）。");
  }

  return parsed;
}

function formatFeishuText(ideas) {
  const lines = ["【今日小红书选题】", ""];

  ideas.forEach((item, index) => {
    const rank = item?.rank ?? index + 1;
    const title = item?.title ?? "未返回标题";
    const hotword = item?.hotword ?? "热点词";
    const matchScore = item?.matchScore ?? 0;
    const angle = item?.angle ?? "无";
    const coverText = item?.coverText ?? "无";

    lines.push(`#${rank} ${title}`);
    lines.push(`热点词：${hotword}`);
    lines.push(`匹配度：${matchScore}`);
    lines.push(`切入角度：${angle}`);
    lines.push(`封面文案：${coverText}`);
    lines.push("");
  });

  return lines.join("\n");
}

async function sendToFeishu(text) {
  const payload = {
    msg_type: "text",
    content: {
      text,
    },
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error("飞书 webhook HTTP 失败：", {
      status: response.status,
      statusText: response.statusText,
      body: raw,
    });
    throw new Error(`飞书请求失败（HTTP ${response.status}）`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("飞书返回非 JSON：", raw);
    throw new Error("飞书返回非 JSON，推送状态未知");
  }

  if (data?.code !== 0) {
    console.error("飞书业务返回失败：", data);
    throw new Error(`飞书返回失败：code=${data?.code}, msg=${data?.msg || "unknown"}`);
  }
}

async function main() {
  if (!webhookUrl) {
    throw new Error("Missing FEISHU_WEBHOOK_URL. 请在根目录 .env 中配置飞书 webhook。");
  }

  const ideas = readIdeas();
  const text = formatFeishuText(ideas);

  await sendToFeishu(text);
  console.log("飞书推送成功");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "飞书推送失败");
  process.exit(1);
});
