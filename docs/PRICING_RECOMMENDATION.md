# Pricing recommendation

For a large mobile-first studio embedding a Twitch-style streaming platform plus AI highlights.

Infrastructure figures come from the interactive cost model (`streaming-infra-cost-model.canvas.tsx`, opened beside the chat in Cursor), built on AWS, LiveKit and bunny.net list prices verified 2026-07. AI figures come from the tiered annotator's own cost meter, not estimates. Every assumption in the model is listed on the canvas so it can be argued with live.

---

## The shape of the deal

Four lines, deliberately separated so each one is defensible on its own terms:

| Line | Basis | Where margin lives |
|---|---|---|
| Platform license | Annual committed, by tier | Most of it |
| Infrastructure | Pass-through at cost + 20% | Thin, by design |
| AI usage | Per unit | 60–75% |
| Data licensing | Revenue share | Variable, potentially the largest line |

The separation is the point. A CFO who sees one blended number that scales with success will discount the whole platform. A CFO who sees a fixed license plus an auditable pass-through will argue about the license and accept the pass-through.

---

## 1. Platform license — annual committed

| Tier | Annual | Scope |
|---|---|---|
| Launch | $250k | One title, one region, standard SLA |
| Portfolio | $600k | Up to three titles, global, 99.9% SLA, co-branded viewer |
| Enterprise | $1.0M | Full portfolio, custom SLA, dedicated support, data program included |

Covers the SDKs (iOS, Unity, Web), the broadcast pipeline, the viewer, chat and moderation, the dashboard, webhooks, and support.

**Why a license at all.** This is the line that is decoupled from volume. It funds the engineering whether they ship one title or ten, and it means we are not forced to price infrastructure above cost to survive. Say that out loud — it makes the cost+20% pass-through credible rather than suspicious.

---

## 2. Infrastructure — transparent pass-through at cost + 20%

Itemized in the dashboard, reconciled monthly against actual AWS and GCP invoices, open to audit.

**Why they should believe cost+20% is actually cheap.** Volume tiers reset monthly and are per-region. Aggregating many studios into one account clears tier steps that a single studio never reaches on its own, and at this volume AWS private pricing typically lands 15–30% below list. So cost+20% against *our* aggregated rate can land at or below their DIY cost against list. That is a testable claim, and it is the strongest thing we can say here.

Commit in writing to passing through future rate reductions. The CDN migration below is worth 8–9x; if we keep that, the whole pass-through story was a lie and they will find out.

### The fixed blended alternative

Some CFOs reject variable lines regardless of how well they are justified. Offer:

- **$0.065 per delivered viewer-hour**
- **$0.10 per stream-hour** (covers streams that go live to nobody)
- True-up band of ±15%; outside it, we reopen

This is a genuine choice, not a trap. Run it against the model:

| Scenario | Cost + 20% | Fixed blended | Better for them |
|---|---|---|---|
| Pilot — 10k stream-hrs, 25 viewers | $18.6k/mo | $17.3k/mo | Fixed |
| Scaled — 200k stream-hrs, 40 viewers | $478k/mo | $540k/mo | Cost-plus |
| Scaled, if on the hybrid HLS path | $597k/mo | $540k/mo | Fixed |

Cost-plus figures are against IVS Real-Time, which is the cheaper IVS path below ~60 concurrent viewers per stream. The fixed rate wins at pilot scale and on the HLS path, and loses at scale on WebRTC. That asymmetry is honest and worth showing them — it demonstrates the number was derived, not picked.

We absorb basis risk on regional mix, ABR mix, and low-viewer streams, and we keep the CDN-migration upside. That is the trade.

### What to tell them about the migration, up front

At scale, delivery is the entire bill and IVS is the wrong place to buy it. IVS output never drops below $0.048 per viewer-hour; the same 720p30 bytes on a commodity CDN volume tier are about $0.0056 — roughly **9x cheaper at the floor, 13x at the first tier**.

| Monthly volume | IVS Real-Time | Own origin + commodity CDN |
|---|---|---|
| 250k viewer-hrs | $15.5k | $2.6k |
| 8M viewer-hrs | $399k | $53k |
| 100M viewer-hrs | $4.9M | $639k |

Start on IVS anyway. Time-to-market dominates at pilot scale, and the commodity path is a team to operate — the per-stream-hour figure above covers ingest, transcode and origin compute but not the engineers. Put the migration on the roadmap as a named milestone with a volume trigger rather than pretending IVS scales economically.

**LiveKit is not the alternative.** At $0.03 per participant-hour plus $0.12/GB egress it lands near $0.166 per viewer-hour — about 3.3x IVS. It is priced for conversational AI with a handful of participants, not broadcast fanout. Mention it only to close it off.

---

## 3. AI usage — per unit

The cost side moved decisively with this release. Google Cloud Video Intelligence was roughly 85% of per-video cost at about $0.10/minute, and Gemini 3 does shot detection, on-screen text reading and object tracking natively. Removing it, plus the Flash-Lite triage tier gating dense annotation, is what makes these prices work.

| Product | Price | Our cost | Margin |
|---|---|---|---|
| Highlight reel (30-min VOD) | $1.50 | $0.40 | 73% |
| Live annotation | $3.00 / stream-hour | $1.20 | 60% |
| Dense world-model annotation | $2.00 / video-hour | $0.50 | 75% |

Note for internal reference: the previously published $0.50/highlight price was underwater against the old $3–5 cost. It clears about 20% margin now, which is why the recommendation is $1.50 and not a defense of $0.50.

Live annotation is priced highest relative to cost because it is the differentiated capability — the reel is ready the instant the stream ends. It is also the line most exposed to model price changes in either direction, so keep the contract language pinned to a per-unit price we can revisit annually rather than a cost-plus formula.

---

## 4. Data licensing — revenue share

**Structure.** The studio owns the corpus and controls consent and opt-out. We operate capture, annotation, packaging, and buyer brokerage.

- **70/30 studio-favorable** when they bring the buyer
- **50/50** when we source the buyer
- The dense annotation fee applies either way, since that is real per-hour cost regardless of who closes

**Why this can fund the entire platform.** World-model and spatial-intelligence labs cannot buy globally-scaled real-world egocentric video. They can scrape the web. They cannot get millions of hours of camera-through-a-human's-eyes footage with synchronized action labels. For a portfolio that includes a real-world AR title, that is the highest-value asset in the building, and it is currently generating nothing.

The reason our annotation is worth paying for rather than commodity: an embedded SDK can capture **engine telemetry** — actual input events and game state at 30–60Hz, aligned to video PTS. Comparable public datasets had to reverse-engineer this from replay files or instrument a game from scratch. Layer 0 of the SWA-1 schema means annotation is *verified against engine truth* rather than inferred from pixels. That is a structural advantage, not a quality claim.

Export is LeRobot v3.0, Parquet, and RLDS. Being drop-in for the formats labs already load is a more credible signal of "world-model ready" than any schema document.

---

## Gating work — name it, do not gloss it

Raise these unprompted. A vendor who surfaces the hard parts is more credible than one who discovers them during diligence, and every item here is solvable.

**Consent.** Per-session explicit opt-in for capture, separate from streaming consent, and separate again for data licensing. Buried-in-ToS consent will not survive scrutiny from either a regulator or a buyer's legal team. Build the opt-out so it propagates to already-exported corpora — that is the genuinely hard engineering, not the checkbox.

**Privacy, specifically for real-world AR.** Footage will contain bystanders' faces, license plates, house exteriors, and precise geolocation. This needs face and plate blurring at capture time (not as a later pass), geo-fuzzing on export, and a documented deletion path that reaches shipped datasets. Under GDPR this is a data protection impact assessment, not a policy paragraph.

**Third-party IP is the real blocker on the most valuable asset.** Licensing gameplay video to an AI lab for model training is very likely outside the scope of an existing game IP license:

| Title | IP position | Data-licensing path |
|---|---|---|
| Wholly-owned titles | Clean | Available now |
| Licensed board/brand titles | Brand licensor consent needed | Negotiable |
| Licensed character AR titles | Character licensor consent needed | Hardest, highest value |

The strategic recommendation follows directly: **start the data program on a wholly-owned title.** It proves the pipeline, produces a real corpus and a real buyer conversation, and builds the track record that makes the licensor conversation on the flagship title possible. Trying to start with the crown jewel means starting with a legal negotiation instead of a product.

**Training-rights scope.** Labs will push for perpetual and irrevocable. The studio will want field-of-use limits and no competitive-product carve-outs. Settle this in the template agreement before the first buyer conversation, not during it.

---

## What to actually say in the room

1. The license is what you are buying. It does not scale with your success.
2. Infrastructure is pass-through at cost plus 20%, itemized, auditable, and our aggregated volume likely makes it cheaper than your own.
3. Here is the model. Drive it yourself. Here is where IVS stops making sense and what we do about it.
4. AI is priced per unit at 60–75% margin, and the cost just dropped 8x, which is why these numbers are possible.
5. The data line could pay for all of it. It is also the one with real legal work in front of it, and here is exactly what that work is.
