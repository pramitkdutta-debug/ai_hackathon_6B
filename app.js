/* Browser UI controller. No customer text is persisted to local storage. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { rows: [], mode: "local" };

  const positiveWords = ["love","great","excellent","amazing","easy","fast","helpful","reliable","smooth","perfect","recommend","good","happy","impressed","works well","fantastic","convenient","beautiful","value for money"];
  const negativeWords = ["hate","bad","poor","broken","slow","bug","crash","refund","expensive","disappointed","terrible","awful","unhelpful","late","delay","difficult","confusing","unreliable","waste","worst","issue","problem","doesn't work","not working","overpriced","damaged","missing"];
  const themeRules = [
    ["Pricing", ["price","expensive","cost","cheap","value","overpriced","subscription"]],
    ["Delivery", ["delivery","shipping","arrived","late","courier","dispatch"]],
    ["Product quality", ["quality","damaged","broken","material","defect","durable"]],
    ["Usability", ["easy","difficult","confusing","interface","navigation","setup"]],
    ["Performance", ["slow","fast","crash","bug","loading","performance"]],
    ["Customer support", ["support","service","agent","response","helpful","rude"]],
    ["Features", ["feature","function","integration","option","customization"]],
    ["Returns & refunds", ["refund","return","replacement","exchange"]]
  ];

  function localClassify(text, id) {
    const normalized = text.toLowerCase();
    const p = positiveWords.filter(word => normalized.includes(word)).length;
    const n = negativeWords.filter(word => normalized.includes(word)).length;
    const sentiment = p > n ? "positive" : n > p ? "negative" : "neutral";
    const themes = themeRules.filter(([, words]) => words.some(word => normalized.includes(word)))
      .map(([label]) => label).slice(0, 3);
    return {
      id, sentiment, confidence: sentiment === "neutral" ? 0.55 : 0.68,
      themes: themes.length ? themes : ["General feedback"],
      rationale: "Local keyword-based estimate; review the original comment for context."
    };
  }

  function splitComments(raw) {
    return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      .map((text, index) => ({ id: `FB-${String(index + 1).padStart(3, "0")}`, text }));
  }

  function updateInputCount() {
    const raw = $("feedbackInput").value;
    $("charCount").textContent = `${raw.length.toLocaleString()} characters · ${splitComments(raw).length} comments`;
  }

  function pct(value, total) { return total ? Math.round(value / total * 100) : 0; }

  function render() {
    const rows = state.rows;
    const counts = { positive: 0, neutral: 0, negative: 0 };
    rows.forEach(row => counts[row.sentiment]++);
    const total = rows.length;
    const health = total ? Math.round(((counts.positive + counts.neutral * 0.5) / total) * 100) : 0;
    $("healthScore").textContent = health;
    $("healthBar").style.width = `${health}%`;
    $("healthCaption").textContent = health >= 70 ? "Healthy customer sentiment" : health >= 45 ? "Mixed customer sentiment" : "Customer sentiment needs attention";
    $("positiveCount").textContent = counts.positive;
    $("neutralCount").textContent = counts.neutral;
    $("negativeCount").textContent = counts.negative;
    $("positivePct").textContent = `${pct(counts.positive,total)}% of total feedback`;
    $("neutralPct").textContent = `${pct(counts.neutral,total)}% of total feedback`;
    $("negativePct").textContent = `${pct(counts.negative,total)}% of total feedback`;
    $("totalLabel").textContent = `${total} comments`;
    ["positive","neutral","negative"].forEach(key => {
      const value = pct(counts[key], total);
      $(`${key}Bar`).style.width = `${value}%`;
      $(`${key}Legend`).textContent = `${value}%`;
    });

    const themeCounts = {};
    rows.forEach(row => (row.themes || []).forEach(theme => {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }));
    const themes = Object.entries(themeCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
    const maxTheme = themes.length ? themes[0][1] : 1;
    $("themeList").innerHTML = themes.length ? themes.map(([name,count]) =>
      `<div class="theme-row"><span>${escapeHtml(name)}</span><div class="theme-track"><span style="width:${count/maxTheme*100}%"></span></div><span class="theme-count">${count}</span></div>`
    ).join("") : `<p class="muted">No recurring themes detected.</p>`;

    const filter = $("sentimentFilter").value;
    const visible = filter === "all" ? rows : rows.filter(row => row.sentiment === filter);
    $("rowCount").textContent = `${visible.length} shown`;
    $("feedbackTable").innerHTML = visible.length ? visible.map(row => `
      <tr>
        <td>${escapeHtml(row.text)}</td>
        <td><span class="sentiment-badge badge-${row.sentiment}">${row.sentiment}</span></td>
        <td>${(row.themes || []).map(theme => `<span class="theme-chip">${escapeHtml(theme)}</span>`).join("")}</td>
        <td class="confidence">${Math.round((row.confidence || 0) * 100)}%</td>
      </tr>`).join("") : `<tr><td colspan="4" class="empty-row">No comments match this filter.</td></tr>`;
    $("resultMeta").textContent = `${total} comments analyzed · ${state.mode === "ai" ? "AI-assisted classification" : state.mode === "local-fallback" ? "Local fallback classification" : "Local demo classification"}`;
    $("resultsSection").hidden = false;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);
  }

  async function analyze() {
    $("inputError").textContent = "";
    const comments = splitComments($("feedbackInput").value);
    if (!comments.length) {
      $("inputError").textContent = "Paste at least one non-empty comment before analyzing.";
      $("feedbackInput").focus();
      return;
    }
    if (comments.length > 200) {
      $("inputError").textContent = "Please analyze 200 comments or fewer per batch.";
      return;
    }
    const button = $("analyzeBtn");
    button.disabled = true;
    button.textContent = "Analyzing…";
    try {
      const response = await fetch("/api/classify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments })
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const payload = await response.json();
      const byId = new Map((payload.results || []).map(result => [result.id, result]));
      state.rows = comments.map(comment => {
        const result = byId.get(comment.id) || localClassify(comment.text, comment.id);
        return { ...comment, ...result };
      });
      state.mode = payload.mode || "local";
      if (payload.warning) $("inputError").textContent = payload.warning;
      render();
      $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      // Offline fallback keeps the core demo usable if the server endpoint is unreachable.
      state.rows = comments.map(comment => ({ ...comment, ...localClassify(comment.text, comment.id) }));
      state.mode = "local";
      $("inputError").textContent = "Could not reach the analysis service. Showing local keyword-based results.";
      render();
    } finally {
      button.disabled = false;
      button.innerHTML = "<span>✦</span> Analyze feedback";
    }
  }

  function exportCsv() {
    if (!state.rows.length) return;
    const columns = ["ID","Comment","Sentiment","Themes","Confidence","Rationale"];
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [columns.map(quote).join(",")];
    state.rows.forEach(row => lines.push([
      row.id, row.text, row.sentiment, (row.themes || []).join("; "),
      `${Math.round((row.confidence || 0) * 100)}%`, row.rationale || ""
    ].map(quote).join(",")));
    // UTF-8 BOM improves Excel compatibility for text containing non-English characters.
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `feedback-analysis-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function checkMode() {
    try {
      const response = await fetch("/api/health");
      const payload = await response.json();
      $("modeLabel").textContent = payload.mode === "ai" ? "AI mode enabled" : "Local demo mode";
    } catch {
      $("modeLabel").textContent = "Browser fallback mode";
    }
  }

  $("feedbackInput").addEventListener("input", updateInputCount);
  $("analyzeBtn").addEventListener("click", analyze);
  $("clearBtn").addEventListener("click", () => {
    $("feedbackInput").value = ""; state.rows = []; $("inputError").textContent = "";
    $("resultsSection").hidden = true; updateInputCount();
  });
  $("sampleBtn").addEventListener("click", async () => {
    try {
      const response = await fetch("/sample_feedback.txt");
      if (!response.ok) throw new Error("Sample file unavailable");
      $("feedbackInput").value = await response.text();
      updateInputCount();
      $("feedbackInput").focus();
    } catch {
      $("inputError").textContent = "Could not load sample data. Paste comments manually.";
    }
  });
  $("exportBtn").addEventListener("click", exportCsv);
  $("sentimentFilter").addEventListener("change", render);
  checkMode();
  updateInputCount();
})();
