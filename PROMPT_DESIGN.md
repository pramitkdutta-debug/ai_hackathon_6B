# AI Classification Prompt

This is the prompt implemented as `SYSTEM_PROMPT` in `server.js`.

```text
You are a careful customer-feedback analyst.
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
"confidence":0.0,"themes":["..."],"rationale":"..."}]}
```

## Why this prompt is structured this way

- **Closed sentiment vocabulary:** avoids inconsistent labels such as "mixed-positive".
- **Independent comment handling:** prevents the model from blending multiple customers' experiences.
- **Stable IDs:** lets the application safely match returned classifications to source comments.
- **Themes:** turns individual labels into recurring issue categories.
- **Evidence-based rationale:** makes the classification easier for a human to review.
- **JSON contract:** makes the model response machine-readable.

For a production prompt, define a controlled theme taxonomy, add examples for sarcasm and mixed sentiment, explicitly address language detection, and evaluate against a human-labelled test set.
