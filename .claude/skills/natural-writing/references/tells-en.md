# English tells

Numbered strongest first. **Strong** = act on one sighting. **Weak alone** = act only
when other tells share the passage. Structural habits persist across model releases;
word habits rotate, so the structures lead.

Sources: `blader/humanizer` v3 (MIT, aligned with Wikipedia 2026-09-06) · Wikipedia
*Signs of AI writing* (revision of 2026-09-24) · The Economist, *How to spot AI
writing* (2026-08: its articles against ChatGPT, Claude, Gemini and Grok rewrites,
55 940 sentences).

## A. Staging instead of stating (strong)

### 1. Not X but Y

Watch for: not X but Y · not just / not only X, but Y · it's not X, it's Y · X rather
than Y · the split form ("This does not mean X. It means Y.") · a clipped tail (", no
guessing"). The Economist (2026) still finds it more frequent in chatbot text than in
its own. Keep a contrast only when the negative half corrects a belief the reader holds.

❌ It's not just a cache, it's a performance strategy.
✅ The cache cuts repeat queries to the database.

### 2. One-line closers and dramatic fragments

Watch for: a one-sentence paragraph that restates the one before · "That's the real
win." · "Let that sink in." · a row of fragments ("No config. No setup.").

❌ Retries hide brief outages. That's the real win.
✅ Retries hide outages shorter than 30 seconds.

### 3. Sayings that sound deep

Watch for: at its core · the real question is · what really matters · X is the Y of Z ·
the language of / the currency of.

❌ At its core, observability is the language of trust.
✅ Logs and metrics let the on-call engineer see why a request failed.

### 4. Staged run-up

Watch for: Let's dive in · let's break this down · here's what you need to know ·
Here's the thing · Honestly? (standalone) · quick note.

❌ Let's dive into how the queue works. Here's what you need to know.
✅ The queue retries each job three times, then moves it to the dead-letter table.

### 5. Arguing with no one

Watch for: This isn't about · I'm not saying · To be clear · Don't get me wrong ·
A tempting approach would be · You might think… but.

❌ A tempting approach would be restarting the service nightly, but that drops sessions. Tokens rotate in place.
✅ Tokens rotate in place every 24 hours.

## B. Rhythm by rule

### 6. Forced triads (strong at scale, weak for one list)

Ideas arrive in threes whether or not the meaning has three parts: "fast, reliable, and
scalable"; three parallel examples; three short facts then a lesson. Keep three real items.

❌ The release brings speed, stability, and simplicity.
✅ The release halves cold-start time.

### 7. Repeated sentence openings (weak alone)

❌ It parses the file. It validates the schema. It writes the output.
✅ It parses and validates the file, then writes the output.

### 8. Dashes as the universal connector

Final text has no em dash (—), en dash (–) or ` -- ` used as a dash, unless the user's
sample uses them. Replace with a period, comma, colon or parentheses. Code, paths and
URLs keep theirs. As a tell it depends on the writer: The Economist (2026) found that
among current chatbots only Claude uses more dashes than professional writers, and
Wikipedia notes OpenAI tuned GPT-5.1 to suppress them. Strong in text Claude wrote;
weak alone in text from other sources.

❌ The migration — long overdue — runs tonight.
✅ The migration, long overdue, runs tonight.

### 9. Stacked qualifiers (weak alone)

Watch for: could potentially · might arguably · it's also possible · in some cases it may.
Keep scope limits, legal and safety notes, and real doubt.

❌ This could potentially help in some cases.
✅ This may help.

### 10. Long, even sentences with no short ones (weak alone)

The Economist (2026) found chatbot prose uses long sentences, few commas and semicolons,
almost no parentheses, and "And" as a stock connector. Vary the length; let a short
sentence carry a fact.

## C. Inflation and borrowed authority

### 11. Overused AI words (strong in clusters)

Words rotate by model generation (Wikipedia, 2026):

| Era | Words |
|---|---|
| GPT-4 (2023 to mid-2024) | additionally, boasts, bolstered, crucial, delve, emphasizing, enduring, garner, intricate, interplay, key (adj.), landscape (abstract), meticulous, pivotal, underscore, tapestry, testament, valuable, vibrant |
| GPT-4o (mid-2024 to mid-2025) | align with, bolstered, crucial, emphasizing, enhance, enduring, fostering, highlighting, pivotal, showcasing, underscore, vibrant |
| GPT-5 (mid-2025 on) | emphasizing, enhance, highlighting, showcasing, plus notability words |
| Grok (2026) | underscore, causal, empirical, correlate |

The Economist (2026) adds a current trait that word lists miss: polysyllabic and
scientific words ("significant", "parameter"), nominalisations and rare abstract nouns
("interdependence"). Prefer the short verb. A formal word outside these lists is not a
tell by itself; "robust" and "gate" stay when they are technical terms.

❌ This PR meticulously enhances the robustness of the ingestion pipeline, underscoring our commitment to reliability.
✅ This PR retries failed uploads instead of dropping them.

### 12. Inflated significance

Watch for: a pivotal moment · plays a key role · marks a shift · reflects a broader ·
lasting legacy · setting the stage · the future looks bright · a stock "Challenges and
outlook" section. End on the last concrete fact.

### 13. Vague connection

Watch for: associated with · in connection with · linked to · tied to. Name the relation
the source gives; if it gives none, keep the vague word rather than inventing a role.

### 14. Shallow -ing riders

Watch for: …, highlighting · ensuring · reflecting · contributing to · fostering ·
showcasing. Keep the fact; keep the rider only if the source supports it.

❌ The endpoint returns cached data, ensuring a seamless experience.
✅ The endpoint returns cached data, so the page loads without a second query.

### 15. Sales language

Watch for: boasts · seamless · cutting-edge · powerful · robust (figurative) ·
game-changing · nestled · in the heart of · stunning · must-have.

### 16. Borrowed authority

Watch for: experts argue · industry reports · several publications · cited in [list of
outlets]. Use the named source and what it said, or cut the claim. Never invent a source.

### 17. Avoiding is / has

Watch for: serves as · stands as · functions as · boasts · features · offers.

❌ The service serves as the gateway and boasts three replicas.
✅ The service is the gateway and has three replicas.

## D. Formatting by rule

### 18. Bold as decoration

Bold scattered across a paragraph, or every list item with a bold label and colon.
Remove the bold; turn a labeled list into prose when the labels add nothing.

❌ - **Performance:** Performance has been improved.
✅ Pages load faster because the query now uses an index.

### 19. Decorative headings

Title Case Headings, emoji or arrows in headings and bullets, a rule between every
section, a top heading that repeats the title. Use sentence case.

### 20. Curly quotes (weak alone)

“…” where the format uses straight quotes. Most editors curl quotes automatically.

## E. Leftovers from chat and draft (strong; remove outright)

### 21. Chatbot residue

I hope this helps · Certainly! · Great question! · Let me know if · Would you like me to ·
Here is a… The most certain tell; easy to miss when it wraps real content.

### 22. Knowledge-limit disclaimers and guesses

as of my last update · based on available information · not widely documented · likely
[grew up / began]. State what the source does not show, or cut the sentence.

### 23. Heading repeated in the first sentence

❌ `## Performance` → "Performance matters." → real content.
✅ `## Performance` → real content.

### 24. Writing about the previous version

Docs and comments describe what the text replaced. Keep history for changelogs,
release notes and migration guides.

❌ This function replaces the old loop that was O(n²).
✅ This function uses a hash map for O(1) lookups.
