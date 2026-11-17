/**
 * Customer Feedback & Sentiment Board
 * Small Express server: serves the browser app and optionally proxies requests
 * to an OpenAI-compatible chat-completions endpoint. API credentials stay here.
 */
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = "1mb";

app.use(express.json({ limit: MAX_BODY_BYTES }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `You are a careful customer-feedback analyst.
Classify every supplied customer comment independently.
For each comment return:
- sentiment: exactly "positive", "neutral", or "negative"
- confidence: a number from 0 to 1
- themes: an array of 1 to 3 short, concrete topic labels
- rationale: a concise explanation grounded only in the comment
Do not infer facts that are not present. Mixed feedback should be classified by
the dominant customer experience. Sarcasm, negation, and context matter.
Return ONLY valid JSON in this shape:
{"results":[{"id":"input id","sentiment":"positive|neutral|negative",
"confidence":0.0,"themes":["..."],"rationale":"..."}]}`;

function localClassify(text, id) {
  const positive = ["love", "great", "excellent", "amazing", "easy", "fast", "helpful",
    "reliable", "smooth", "perfect", "recommend", "good", "happy", "impressed",
    "works well", "fantastic", "convenient", "beautiful", "value for money"];
  const negative = ["hate", "bad", "poor", "broken", "slow", "bug", "crash", "refund",
    "expensive", "disappointed", "terrible", "awful", "unhelpful", "late", "delay",
    "difficult", "confusing", "unreliable", "waste", "worst", "issue", "problem",
    "doesn't work", "not working", "overpriced", "damaged", "missing"];
  const s = text.toLowerCase();
  const p = positive.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
  const ng = negative.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
  let sentiment = "neutral";
  if (p > ng) sentiment = "positive";
  if (ng > p) sentiment = "negative";
  const themeRules = [
    ["Pricing", ["price", "expensive", "cost", "cheap", "value", "overpriced", "subscription"]],
    ["Delivery", ["delivery", "shipping", "arrived", "late", "courier", "dispatch"]],
    ["Product quality", ["quality", "damaged", "broken", "material", "defect", "durable"]],
    ["Usability", ["easy", "difficult", "confusing", "interface", "navigation", "setup"]],
    ["Performance", ["slow", "fast", "crash", "bug", "loading", "performance"]],
    ["Customer support", ["support", "service", "agent", "response", "helpful", "rude"]],
    ["Features", ["feature", "function", "integration", "option", "customization"]],
    ["Returns & refunds", ["refund", "return", "replacement", "exchange"]]
  ];
  const themes = themeRules.filter(([, words]) => words.some(w => s.includes(w)))
    .map(([label]) => label).slice(0, 3);
  return {
    id, sentiment, confidence: sentiment === "neutral" ? 0.55 : 0.68,
    themes: themes.length ? themes : ["General feedback"],
    rationale: "Local keyword-based estimate; review the original comment for context."
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.AI_ENABLED === "true" && Boolean(process.env.AI_API_KEY) ? "ai" : "local"
  });
});

app.post("/api/classify", async (req, res) => {
  const comments = req.body && req.body.comments;
  if (!Array.isArray(comments) || comments.length === 0) {
    return res.status(400).json({ error: "comments must be a non-empty array" });
  }
  if (comments.length > 200) {
    return res.status(400).json({ error: "Maximum 200 comments per request" });
  }
  if (comments.some(c => !c || typeof c.id !== "string" || typeof c.text !== "string" || !c.text.trim())) {
    return res.status(400).json({ error: "Each comment requires a string id and non-empty text" });
  }

  const aiEnabled = process.env.AI_ENABLED === "true" && Boolean(process.env.AI_API_KEY);
  if (!aiEnabled) {
    return res.json({ mode: "local", results: comments.map(c => localClassify(c.text, c.id)) });
  }

  try {
    const endpoint = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ comments }) }
        ]
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AI provider returned ${response.status}: ${detail.slice(0, 300)}`);
    }
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    const byId = new Map((parsed.results || []).map(r => [String(r.id), r]));
    const allowed = new Set(["positive", "neutral", "negative"]);
    const results = comments.map(c => {
      const r = byId.get(c.id);
      if (!r || !allowed.has(r.sentiment)) return localClassify(c.text, c.id);
      return {
        id: c.id,
        sentiment: r.sentiment,
        confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0.5)),
        themes: Array.isArray(r.themes) ? r.themes.slice(0, 3).map(String) : ["General feedback"],
        rationale: String(r.rationale || "No rationale supplied.")
      };
    });
    res.json({ mode: "ai", results });
  } catch (error) {
    console.error("AI classification failed:", error.message);
    // Keep the product usable when the provider is unavailable.
    res.json({
      mode: "local-fallback",
      warning: "AI provider unavailable; local keyword classification was used.",
      results: comments.map(c => localClassify(c.text, c.id))
    });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Feedback Board running at http://localhost:${PORT}`);
});
