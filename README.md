# Browser-Based Customer Feedback & Sentiment Board

A small, hackathon-ready web app that turns pasted customer reviews into a sentiment dashboard. It includes:
- Multi-line feedback input (one comment per line)
- Positive / neutral / negative classification
- Brand health score and sentiment distribution
- Recurring theme / complaint keyword summary
- Filterable classified-feedback table
- One-click CSV export (opens in Excel, Google Sheets, and other spreadsheet tools)
- 30 sample customer comments
- Optional AI mode through a server-side OpenAI-compatible API integration
- Local keyword-based fallback so the demo works without an API key

## 1. Requirements

- Node.js 18 or later (Node 18+ includes `fetch`)
- npm (included with Node.js)
- A modern browser (Chrome, Edge, Firefox, Safari)

No database, account, build tool, or frontend framework is required.

## 2. Run locally

1. Extract the project ZIP.
2. Open a terminal in the extracted `customer-feedback-sentiment-board` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open **http://localhost:3000** in your browser.
6. Click **Load sample data**, then **Analyze feedback**.
7. Use the sentiment filter to inspect results. Click **Export spreadsheet** to download a CSV file.

To stop the server, press `Ctrl+C` in the terminal.

## 3. Enable AI-assisted classification (optional)

The app runs in local demo mode by default. For semantic classification using an LLM:

1. Copy `.env.example` to `.env`.
2. Set the following values in `.env`:

   ```env
   AI_ENABLED=true
   AI_BASE_URL=https://api.openai.com/v1
   AI_MODEL=gpt-4o-mini
   AI_API_KEY=your_secret_api_key
   PORT=3000
   ```

3. Save `.env`, then restart the server with `npm start`.
4. Reload the browser page. The top-right status should show **AI mode enabled**.

The backend sends the comments to the configured OpenAI-compatible `/chat/completions` endpoint. The API key is read only by `server.js`; it is never sent to the browser. If the provider request fails or returns incomplete records, the app falls back to local classification.

**Security:** Do not commit `.env`, share your API key, or put secrets in `public/app.js`. For a public deployment, add authentication, rate limiting, request quotas, HTTPS, retention controls, and a privacy notice before accepting real customer data. Confirm your organization's policy before sending customer feedback to an external AI provider.

## 4. Input format and limits

- Paste one review or comment per line.
- Blank lines are ignored.
- Maximum 200 comments per analysis request.
- The sample file is `data/sample_feedback.txt` (also served at `/sample_feedback.txt` for the Load sample data button).
- For multi-line comments, this starter version treats each non-empty line as an individual comment. If your source contains paragraphs that belong together, preprocess them into one line per comment or extend the input format to CSV/JSON.

## 5. How the analysis works

### Local demo mode
The local classifier compares each comment against small positive and negative keyword lists. It extracts themes using transparent keyword groups such as Pricing, Delivery, Product quality, Usability, Performance, Customer support, Features, and Returns & refunds.

This mode is deterministic, fast, and does not transmit feedback to an AI provider. It is a demonstration baseline, **not a true language model**. It can miss sarcasm, negation, mixed sentiment, spelling variations, and context.

### AI mode
When enabled, the server sends the batch to the configured model with the prompt in `server.js`. The model returns one structured record per comment:
- `sentiment`: positive, neutral, or negative
- `confidence`: estimated confidence from 0 to 1
- `themes`: up to three short labels
- `rationale`: short evidence-based explanation

The UI joins results back to the original comment using a stable comment ID. Invalid/missing model outputs are replaced with local fallback results.

### Brand health score
The displayed score is a simple weighted index:

`Brand Health = round((positive_count + 0.5 × neutral_count) / total_count × 100)`

It ranges from 0 to 100. It is not an NPS score, customer satisfaction survey score, or statistically validated metric. Explain the definition whenever presenting it to stakeholders.

### Recurring themes
The dashboard counts all theme labels across comments and displays the five most frequently assigned labels. Theme counts are comment-theme occurrences, so one comment can contribute to more than one theme.

## 6. Project structure

```text
customer-feedback-sentiment-board/
├── public/
│   ├── index.html             # Page structure and accessible form controls
│   ├── styles.css             # Responsive visual styling
│   ├── app.js                 # Browser state, API call, dashboard, CSV export
│   └── sample_feedback.txt    # Sample data loaded by the UI
├── data/
│   └── sample_feedback.txt    # Original 30-comment sample dataset
├── .env.example               # Optional AI provider configuration template
├── .gitignore                 # Excludes secrets and dependencies
├── package.json               # Node dependencies and run scripts
├── server.js                  # Static server, classifier API, AI prompt and fallback
├── ARCHITECTURE.md            # System architecture and request/data flow
└── README.md                  # Setup, usage, limitations and troubleshooting
```

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| `npm` or `node` not found | Install Node.js 18+ and reopen the terminal |
| Port 3000 is already in use | Set `PORT=3001` in `.env`, restart, and open `http://localhost:3001` |
| Browser says it cannot connect | Confirm `npm start` is still running and use the exact localhost URL |
| AI mode does not activate | Check `.env` filename, `AI_ENABLED=true`, and that `AI_API_KEY` is not blank; restart server |
| AI provider returns an error | Check key, model name, endpoint compatibility, network access, and provider quota; local fallback is automatic |
| Sample data does not load | Confirm `public/sample_feedback.txt` exists in the extracted folder |

## 8. Suggested hackathon demo script

1. Open the app and explain the problem: customer feedback is scattered and hard to summarize.
2. Load the 30 sample comments.
3. Run analysis and point out the positive / neutral / negative split.
4. Explain the brand health formula and show the most frequent themes.
5. Filter to negative comments and discuss actionable issues such as delivery, product quality, or support.
6. Export the table and open it in a spreadsheet.
7. If configured, repeat with AI mode and compare nuanced classifications against local keyword mode.

## 9. Known limitations and sensible next steps

- No authentication, database, team workspace, or historical trend storage.
- One comment per non-empty line; no file upload in this starter version.
- CSV is used as the spreadsheet interchange format; it is supported by Excel and Google Sheets.
- The local classifier is deliberately simple and should not be represented as an LLM.
- Model output may be imperfect; human review is important for high-impact decisions.

Potential extensions: upload CSV/XLSX, language detection, aspect-based sentiment, deduplication, date/source filters, saved analysis history, configurable taxonomy, role-based access, and scheduled ingestion from review platforms.
