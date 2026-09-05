# Chess Tournament Growth Tracker

A single-file, mobile-first web app for parents to track a young player's chess
tournament performance — **separating the result from the quality of the effort**.

> Results matter, but controllable behaviours matter more.

No backend, no accounts, no AI, no API keys. One `index.html`. All data stays in
the browser it was entered in.

---

## Core idea

Two scores are tracked side by side:

| | What it measures | Who controls it |
|---|---|---|
| **Tournament score** | Wins / draws / losses, out of 6 | Partly outside the player's control |
| **Process score** | Habits, out of 20 | Almost entirely in the player's control |

The tournament score sets the **base** reward or consequence. The process score
**modifies** it. A low result with an excellent process is treated very
differently from a low result with a careless process.

---

## The five process categories (0–4 each, 20 total)

| | Category | Looks at |
|---|---|---|
| A | Notation & Time Recording | Complete, clear notation; clock notes; recovery when incomplete |
| B | Thinking Discipline | Thinking before moving; slowing down in critical positions; checking threats |
| C | Time Management | Using the clock; spending time where it matters; avoiding self-inflicted time pressure |
| D | Responsibility / Recovery | Owning the game; reconstructing it; explaining it; constructive after a loss |
| E | Game Quality / Decisions | Parent/coach review + engine info, read **in context** |

### Round marks

Each round, each category gets one of:

| Mark | Meaning | Credit |
|---|---|---|
| ✓ | Met | 1.00 |
| ★ | **Recovered / took initiative** | **1.25** |
| △ | Partly met | 0.50 |
| ✗ | Not yet | 0.00 |
| *(blank)* | Not applicable — excluded from the maths | — |

**★ deliberately scores above ✓.** Something went wrong and the player fixed it
himself — reconstructed the notation, found the opponent, entered the game while
he still remembered it. The whole system is designed to reward that.

### How a 0–4 is suggested

Credits are summed, scaled to a 6-round basis, then banded:

| Rounds meeting the standard | Suggested |
|---|---|
| 5–6 | 4 |
| 4 | 3 |
| 2–3 | 2 |
| 1 | 1 |
| 0 | 0 |

The parent can override any category. **The suggestion stays on screen** next to
the override, with an optional one-line reason, so the two are always comparable.

Engine statistics never feed this calculation. They are displayed as supporting
context only — a 75-accuracy game against a strong opponent in a sharp position
can be excellent; a 90-accuracy game with one avoidable blunder may not be.

---

## Reward table (6-round basis)

| Score | Outcome |
|---|---|
| 6.0 | **$2,000** — shown as a special achievement, not an expected target |
| 5.5 | $150 |
| 5.0 | $75 |
| 4.5 | $40 |
| 4.0 | $20 |
| 3.5 | $10 |
| 3.0 | $5 |
| 2.5 | No reward, no consequence |
| 2.0 | No games for 1 week |
| 1.5 | No games for 2 weeks |
| 1.0 | No games for 1 month |
| 0.5 | No games for 6 weeks |
| 0.0 | No games for 2 months |

Tournaments with a round count other than 6 are converted to a 6-round
equivalent (`score / rounds × 6`, snapped to the nearest 0.5) before lookup.

## Process modifier

| Process | Label | Effect |
|---|---|---|
| 18–20 | Excellent tournament process | +20% reward · **consequence waived entirely** |
| 15–17 | Strong process | +10% reward · consequence halved |
| 12–14 | Developing / acceptable | Normal result rule |
| 9–11 | Needs improvement | Normal result rule + focus areas highlighted |
| 0–8 | Significant improvement needed | Normal result rule + focus areas highlighted |

A weak process **never adds** punishment. It only removes the discount.

**Worked example:** 2.0 / 6 → base consequence "no games for 1 week". Process
19 / 20 → **waived**, because the effort, responsibility and habits were there.

---

## Screens

- **Tournaments** — in-progress card + history
- **Rounds** — one tap per round; result, opponent, colour, five category marks,
  optional engine stats, notes. Designed for ~30–60 seconds per round.
- **Process** — suggested vs final 0–4 per category, with override
- **Summary** — score, reward/consequence, process breakdown, what went well,
  next-tournament focus (1–3 items), copy-as-text
- **Progress** — trend per category across tournaments, result vs process
- **More** — the full rule tables, player name, export/import, erase

## Privacy

The player's name is **entered on first run and stored in the browser only**. It
is not in the app file. A copy of this app, published anywhere, is completely
generic until someone enters a name on their own device.

All tournament data lives in `localStorage`. Nothing is uploaded. Use
**More → Export backup** before clearing site data or moving to another phone.

---

## Development

Open `index.html` in a browser. That's the whole build step.

Run the test suite (73 assertions covering the scoring engine, both worked
examples from the spec, byes, pluralisation, prorating, and a render smoke test):

```sh
node test.js        # needs jsdom
```

Verified on real Chrome at 320 / 390 / 430 px: no horizontal scroll, no
overflowing elements, bottom nav intact.
