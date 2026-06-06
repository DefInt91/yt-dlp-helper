const sourceUrl = document.querySelector("#source-url");
const sourceText = document.querySelector("#source-text");
const fetchButton = document.querySelector("#fetch-button");
const analyzeButton = document.querySelector("#analyze-button");
const clearButton = document.querySelector("#clear-button");
const copyButton = document.querySelector("#copy-button");
const statusPill = document.querySelector("#status-pill");
const summaryOutput = document.querySelector("#summary-output");
const jsonOutput = document.querySelector("#json-output");

const listOutputs = {
  locations: document.querySelector("#locations-output"),
  products: document.querySelector("#products-output"),
  prices: document.querySelector("#prices-output"),
  uses: document.querySelector("#uses-output"),
};

const emptyResult = {
  source_url: "",
  summary: "等待輸入資料。",
  locations: [],
  products: [],
  prices: [],
  uses: [],
};

let currentResult = { ...emptyResult };

function setStatus(message, tone = "ready") {
  statusPill.textContent = message;
  statusPill.dataset.tone = tone;
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLines(text) {
  return normalizeText(text)
    .split(/\n|。|\.|\?|？|!|！/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueItems(items, maxItems = 6) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const cleanItem = item.replace(/\s+/g, " ").trim();
    const key = cleanItem.toLowerCase();

    if (!cleanItem || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleanItem);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function extractPrices(text) {
  const pricePattern = /(?:NT\$|TWD|USD|US\$|\$|€|¥|HK\$|RMB|CNY)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:元|新台幣|美元|日圓|港幣)/gi;
  return uniqueItems(text.match(pricePattern) || []);
}

function extractByKeywords(lines, keywords) {
  return uniqueItems(
    lines.filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase()))),
  );
}

function extractProducts(lines) {
  const productLines = extractByKeywords(lines, ["商品", "產品", "品名", "型號", "product", "model", "item"]);
  const titleLikeLines = lines.filter((line) => line.length >= 4 && line.length <= 48);
  return uniqueItems([...productLines, ...titleLikeLines], 5);
}

function buildSummary(lines) {
  if (lines.length === 0) {
    return "沒有足夠內容可整理。";
  }

  const usefulLines = lines
    .filter((line) => line.length >= 12)
    .sort((a, b) => b.length - a.length);

  return uniqueItems(usefulLines, 3).join(" / ") || lines.slice(0, 3).join(" / ");
}

function analyzeContent() {
  const text = normalizeText(sourceText.value);
  const lines = splitLines(text);

  if (!text) {
    currentResult = {
      ...emptyResult,
      source_url: sourceUrl.value.trim(),
      summary: "請先貼上 URL 或頁面文字。",
    };
    renderResult(currentResult);
    setStatus("Need input", "warn");
    return;
  }

  currentResult = {
    source_url: sourceUrl.value.trim(),
    summary: buildSummary(lines),
    locations: extractByKeywords(lines, ["地點", "地址", "位置", "門市", "台北", "新北", "桃園", "台中", "台南", "高雄", "location", "address", "located"]),
    products: extractProducts(lines),
    prices: extractPrices(text),
    uses: extractByKeywords(lines, ["用途", "適合", "用於", "可以", "功能", "特色", "use", "purpose", "feature", "for "]),
  };

  renderResult(currentResult);
  setStatus("Organized", "done");
}

function renderList(element, items) {
  element.innerHTML = "";

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-item";
    emptyItem.textContent = "未偵測到明確資料";
    element.appendChild(emptyItem);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    element.appendChild(li);
  }
}

function renderResult(result) {
  summaryOutput.textContent = result.summary;
  renderList(listOutputs.locations, result.locations);
  renderList(listOutputs.products, result.products);
  renderList(listOutputs.prices, result.prices);
  renderList(listOutputs.uses, result.uses);
  jsonOutput.textContent = JSON.stringify(result, null, 2);
}

async function fetchUrlText() {
  const url = sourceUrl.value.trim();

  if (!url) {
    setStatus("Missing URL", "warn");
    sourceUrl.focus();
    return;
  }

  setStatus("Fetching", "busy");

  try {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    doc.querySelectorAll("script, style, noscript, svg").forEach((node) => node.remove());

    const title = doc.querySelector("title")?.textContent || "";
    const description = doc.querySelector('meta[name="description"]')?.content || "";
    const pageText = normalizeText(`${title}\n${description}\n${doc.body?.innerText || ""}`);

    sourceText.value = pageText;
    setStatus("Fetched", "done");
    analyzeContent();
  } catch (error) {
    setStatus("Paste text", "warn");
    sourceText.placeholder = "此網站可能阻擋瀏覽器直接抓取。請把頁面文字貼在這裡後再整理。";
  }
}

async function copyJson() {
  await navigator.clipboard.writeText(jsonOutput.textContent);
  setStatus("Copied", "done");
}

fetchButton.addEventListener("click", fetchUrlText);
analyzeButton.addEventListener("click", analyzeContent);
copyButton.addEventListener("click", copyJson);
clearButton.addEventListener("click", () => {
  sourceUrl.value = "";
  sourceText.value = "";
  currentResult = { ...emptyResult };
  renderResult(currentResult);
  setStatus("Ready");
});

renderResult(currentResult);
