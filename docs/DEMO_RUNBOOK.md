# Studio demo runbook

Two paths to the same visual result. Rehearse both; lead with the one that cannot fail.

| Path | What it proves | Risk |
|---|---|---|
| **A. Paced replay** | Live annotation, live cost meter, reel assembled at stream end | None — no network, no device |
| **B. iPhone hero** | Their game, their SDK, their phone, annotated live | Device, network, App Store review state |

Open with A so the mechanism is understood, then run B as the payoff. If B fails, A already made the argument.

---

## Path A — paced replay (the guaranteed path)

The pacer feeds a recorded file through the *same* live pipeline at wall-clock rate. The service cannot tell it apart from a live stream, so nothing about the demo is a mock except the clock's source.

### One-time setup

```bash
cd highlight-service
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Transcode footage to the 720p30 profile the pipeline expects.
.venv/bin/python scripts/prepare_demo_content.py

# Annotate every clip once and cache the model responses.
.venv/bin/python scripts/warm_demo_cache.py
```

`warm_demo_cache.py` is the insurance policy. Once the cache is warm, `GEMINI_BACKEND=replay` serves the whole demo from disk: no credentials, no network, no spend, identical output.

### Run it

```bash
cd highlight-service
.venv/bin/uvicorn main:app --port 8000
```

Open **`http://localhost:8000/demo`**, pick a title, press play. (`/` serves the older VOD-upload page — do not type the bare host from memory.)

Check `GET /api/v1/demo/status` first. It returns `ready` plus an explicit `blockers` list, so you know before you start whether the demo can actually run:

```json
{ "ready": false, "cached_responses": 0,
  "blockers": ["Gemini backend is 'replay' but the annotation cache is empty, …"] }
```

**Do not start a demo with `ready: false`.** In replay mode with a cold cache the pipeline degrades cleanly — windows dispatch, triage fails open, dense annotation returns nothing, the session completes and the server survives — but the annotation feed is empty, which is the one thing the demo exists to show. Verified behaviour, not a guess.

### What to point at, in order

1. **Annotations arriving while the video plays.** This is the thing that did not exist before.
2. **The raw SWA-1 rows.** Camera pose, action verb, entity states, causal `cause_event_id` links. This is the world-model pitch — not the reel.
3. **The cost meter.** Tokens and dollars accumulating in real time, per tier. Tie it to the pricing conversation.
4. **The highlight rail re-ranking.** Candidates appear, then reorder as later context arrives.
5. **The reel, ready at stream end.** Not "processing." Ready.

---

## Path B — iPhone hero path

Stumble Guys broadcast from a physical iPhone through the ReplayKit extension into an IVS stage, annotated on screen as it is played.

### What is verified in CI

- The tap compiles for iOS and its sampling, throttling, downscale, queue-bounding and shutdown behaviour are covered by `AnnotationTapTests` (10 tests).
- The wire format is asserted from both ends: `AnnotationTapTests` on the client literals, `test_ios_client_literal_wire_format` on the server parse.
- The server ingest path — JPEG frames muxed into windows, annotated, pruned — is covered by `test_frame_ingest.py`.

### What only a device can prove

Everything below needs real hardware. **Rehearse on the actual demo phone, on the actual network, at least a day ahead.**

1. **Memory headroom.** The extension is killed above ~50 MB RSS. Attach Instruments → Allocations to the *extension* process (not the host app) and confirm the ceiling with the tap enabled. Expect the tap to add a few MB.
2. **Encode cost on the sample queue.** The JPEG encode runs on ReplayKit's queue. Confirm the IVS frame rate holds at 30 fps with the tap running. If it dips, drop `framesPerSecond` to 0.5 before touching anything else.
3. **Thermals.** A 15-minute broadcast with a game running plus the tap is a real thermal load. A throttled phone drops frames.
4. **Network.** Conference and office Wi-Fi are the most common cause of a failed live demo. Test on the venue network if you can, and carry a hotspot.

### Setup

1. App Group entitlement on **both** the host app and the extension.
2. Host app saves `SubstreamBroadcastConfig` with an `annotation` block before presenting the picker. See the [broadcast extension guide](../packages/ios-sdk/Sources/SubstreamSDK/BroadcastExtension/README.md).
3. The annotation service must be reachable from the phone over `wss://` — a real TLS endpoint, not `localhost`. Tunnel it if needed.
4. Create the annotation session *before* the broadcast starts and put its `frames_ws` URL into the config. A stale session id is rejected with code 4404 and you get an empty feed.

### Failure drills

Rehearse each of these, because deciding what to do in the room is how a demo dies.

| If | Then |
|---|---|
| Picker does not list the extension | Wrong `preferredExtension` bundle id. Fall back to Path A. |
| Broadcast starts, annotation feed stays empty | Session id or `wss://` reachability. Keep talking, the broadcast is still live. |
| Annotation stops partway | The tap disabled itself after a send failure, by design. The broadcast is unaffected — say so. |
| Extension dies | Memory. Restart the broadcast with the tap off, then switch to Path A for the annotation story. |
| Network dies entirely | Path A with `GEMINI_BACKEND=replay`. Works with no network at all. |

---

## Pre-flight checklist

Run through this the morning of.

```bash
cd highlight-service
.venv/bin/python -m pytest tests/ -q                    # expect 65 passed
curl -s localhost:8000/api/v1/demo/status | jq          # must report ready: true
```

- [ ] All Python tests pass
- [ ] `/api/v1/demo/status` reports `ready: true` with an empty `blockers` list
- [ ] `cached_responses` is non-zero and covers every title you plan to show
- [ ] Every clip plays end to end in the console at least once
- [ ] Laptop on power, notifications off, screen sleep off
- [ ] Phone charged, in Do Not Disturb, extension rehearsed today
- [ ] Hotspot available
- [ ] Cost canvas open in a second tab, numbers already loaded
