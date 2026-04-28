# RFC 0001 — Tabs vs Story-Feed primary navigation

Status: **Open** (decision pending — Johannes)
Author: Mira Vogt review consolidation
Date: 2026-04-28

## Context

The home view currently exposes two independent navigation models for
the same dataset (`src/components/feed-view.tsx`):

1. **Tab nav** (`Builder News`, `AI World`, `Releases`, `Saved`) —
   filters the chronological card grid via category predicates.
2. **Story mode** — full-screen story-style overlay (Instagram pattern)
   that surfaces the top 12 items by score, opened from a dedicated
   bubble row at the top of the feed.

Both paths share state but compete for the user's first attention.
Mira's UX review (P2) flagged this as a clarity issue: the user has
to learn two mental models on first launch.

## Problem

- Two entry points for the same data → split attention, increased
  cognitive load on first run.
- Tab nav implies "filtering" while Story mode implies "ranked best of
  today" — semantically different but visually equivalent in priority.
- Mobile-first thumb reach favors one primary control, not two
  parallel ones.
- Saved-tab is a personalization layer (different concern from
  category filters); collapsing it into "tabs" muddies the model.

## Options

### A. Story-first, tabs as secondary filter

- Story-feed becomes the primary above-fold experience (full-bleed,
  swipe-driven).
- Tabs collapse into a horizontal chip row below the story strip,
  acting as filters within the chronological list rendered below the
  fold.
- Saved promoted to a dedicated icon in the top bar (bookmark icon).

Pros:
- Story mode aligns with mobile-native muscle memory (Instagram,
  TikTok, Apple News+).
- Removes "two competing primaries" tension.
- LCP unchanged (above-fold story image is already optimized).

Cons:
- Hides the chronological list one swipe deeper — power users who
  scan headlines may resent the extra step.
- "Releases" filter loses prominence; could matter for builder
  audience that explicitly hunts for new tooling.

### B. Tabs-first, story-feed as opt-in mode

- Tabs remain primary nav.
- Story strip moves to a single "Top heute" pill above the card list,
  opens the story overlay on tap.
- Saved stays as 4th tab.

Pros:
- Preserves current scannability for power users.
- Smaller change surface — minimal layout churn.
- Filtering remains the dominant verb, which matches the "radar"
  product positioning ("scan what's new").

Cons:
- Doesn't solve the dual-mental-model issue Mira flagged; just
  visually de-emphasizes story mode.
- Story mode becomes harder to discover.

### C. Drop story mode entirely

- Remove story overlay code.
- Tabs become the only navigation.
- Saved moves to a top-right icon.

Pros:
- Cleanest architecture; one primary surface.
- Removes ~150 lines of story-mode state and gesture handling.

Cons:
- Loses a differentiator (most aggregator apps don't have story view).
- Sunk-cost: story mode is already implemented, tested, and visually
  polished.

## Recommendation

**Option A (Story-first, tabs as filter chips).**

Rationale:
- Mobile-first product pillar argues for a swipe-native primary.
- Tabs naturally compress into chips without losing functionality.
- Mira's swiss/japanese minimalism ethos prefers one primary verb per
  screen.
- Saved as a persistent top-bar icon matches the "personal layer"
  semantics better than a 4th category tab.

## Decision required

Johannes to choose one of A / B / C, or propose a variant. After
decision:

1. Update this RFC's Status to `Accepted` with the chosen option.
2. Open a follow-up implementation task.
3. Coordinate Mira (visual mocks) → Lars (perf budget) → execution.

## Out of scope

- Information architecture for `/article/[id]` detail view.
- Search / saved-search mechanics.
- Push-notification surfaces.
