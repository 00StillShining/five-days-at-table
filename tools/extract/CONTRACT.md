# tools/extract — shared parser contract (Phase 0)

All parsers obey these rules. PLAN.md §2 ("Verified format facts") is binding; source HTML is archival — read-only, never edited.

1. **ESM** (`"type": "module"`). Each parser lives at `tools/extract/<name>.js`, exports `extract()` returning the data object, and when run directly (`node tools/extract/<name>.js`) writes `data/raw/<name>.json` (2-space pretty JSON). No other file writes.
2. **Paths** resolve from the project root (`process.cwd()`); source files are the six HTML files in the root.
3. **HTML** is parsed with cheerio (installed). The Methods/Provisioning bodies are ONE mega-line — never use line-oriented tools. Attribute quirk: `<span class=u>` is UNQUOTED in source; cheerio handles it, but any regex/selector must not assume quotes.
4. **Text normalization:** decode entities (cheerio does); strip comma thousands separators when emitting numeric fields ("2,040 g" → 2040); recognize `×` (U+00D7), `·`, `–` ranges, `→`. Keep prose fields verbatim (entities decoded, whitespace collapsed).
5. **Numbers are numbers** in output JSON; keep the original string alongside only where the plan needs provenance (e.g. shelf-life prose).
6. Every parser output includes an `anomalies: []` array — anything observed that deviates from PLAN §2's stated facts gets recorded there (never silently normalized).
7. **Standing rule:** if faithful extraction is blocked by real ambiguity, STOP — write `data/raw/decision-request.<name>.json` (`{question, context, options[]}`), exit non-zero with a clear message. Never guess.
8. Parsers do not read each other's output. Cross-file reconciliation belongs to `join.js` only.
