# Changelog

## Polish — 27 Sep 2026 (schema v4)

| # | Change | Behaviour |
| :- | :- | :- |
| 1 | **Source field labels** | The claims register's Source field shows the field's label and row ("B4 Results row 3", "B4 Headline result"), never an internal key. It's display-only and links to the field. Stored as key + row. |
| 2 | **System changes banner** | When the system edits a draft (migrations, backfills, repointed evidence), the published view shows "The draft has N system changes. View draft." with a list of what changed; one entry per field. The list clears when a new Rev is published. |
| 3 | **Keep as one pack** | The two-products warning's override needs a reason of at least 20 characters (live counter; the button stays disabled until then). It clears the blocker and records the reason in Activity and on the pack header. |
| 4 | **Claim model mismatch** | A claim whose "Model or factory" names a version (e.g. "engine v2") that isn't B1's version (e.g. "v2.1") is flagged and blocks Launch-ready. Claims marked factory-wide, or naming no version, are skipped. "Create claim from this field" now prefills "Model or factory" from B1. |

## Schema v3 — 27 Sep 2026 (follow-up fixes to the v2 migration)

Runs once per pack when it's next opened, after the v1 → v2 step.

| # | Change | Behaviour |
| :- | :- | :- |
| 1 | **Evidence integrity** | Claims Evidence that cites a renamed or removed field is repointed to its replacement (e.g. "C1 Post-edit effort" → "B4 Results row 3", matched to the B4 row with those numbers); an empty Source field is filled. Evidence citing a field or B4 row that doesn't exist shows **Broken evidence reference** and blocks Launch-ready. |
| 2 | **Stale sign-offs** | A sign-off given before the pack's schema migration, or on a Rev that now has blocking issues, shows grey as **Stale – re-approval needed** and doesn't count towards Launch-ready. |
| 3 | **Per-field review flag** | Every field that received merged or moved content shows **Needs review** until an editor edits it or clicks **Mark reviewed**. The pack header and home card show the count. |
| 4 | **Clean-up** | Editing or marking a field reviewed strips the "From <old field>:" labels. For MT-only packs, Error modes sentences about hallucination, toxicity or prompt injection are flagged with a one-click **Remove LLM-only text** (logged in the activity log). |
| 5 | **Backfill** | If C1 lists exactly one pair at GA or Beta, it fills empty B4 "Language pair / Scope" cells; those cells are highlighted until edited or the field is marked reviewed. |
| 6 | **Claim rule, explicit** | A Public field needs a registered claim only for a performance result, an improvement or delta, or a comparison with another product or engine. Specs and commercial terms (timelines, pilot scope, retention, discounts) are exempt; time amounts count only as an improvement ("saves 22 minutes"). New blocking check: measured specs (B6 Latency, B6 Throughput) with numbers must name their conditions (hardware, load, document type, region or test set). The rule is in the Part E help text. |
| 7 | **B3 thin areas** | Text in B3 about thin, weak or missing coverage is flagged with a one-click **Move to B5 Known weaknesses and gaps** (logged). |

New check kinds: Broken evidence reference and Spec without measurement conditions
(both block); Text in the wrong field and LLM-only content (review flags, don't block).

## Schema v2 — 27 Sep 2026

Goal: record the right information once, in the right place. Packs migrate
automatically the first time they are opened; merged answers are joined under
the new field ("From <old field>: …"), never dropped, and the pack returns to
Draft flagged **Needs review**. Published revisions and their sign-offs stay in
the history. Rule tests: `npx tsx scripts/checks.test.ts`.

### Merged
| New field | Tag | Was |
| :- | :- | :- |
| B2 Oversight and assurance | P · Required | B2 Required oversight + B7 Assurance levels |
| B5 Error modes | N | B5 Typical errors + B5 Safety risks (LLM prompts shown only for LLM Model) |
| D1 Packaging & pricing | N · Required | D1 How it's sold + Pricing basis + Credit mapping |
| D3 Deliverables and reporting | P | D3 What customers get + Ongoing reporting |
| B7 How arbitr uses it | P | B7 Where it appears |
| B7 ↳ Routing logic (sub-note) | N | B7 Routing |
| D3 ↳ Customer-trained build (sub-list, only with C4) | P | C4 Onboarding steps |

### Removed
| Field | Where its content goes |
| :- | :- |
| C1 Quality by pair | B4 Results (one row per pair); old text kept as a migration note |
| C1 Post-edit effort | B4 Results; old text kept as a migration note |
| D3 Request process | Factory-wide setting A9 Request process, shown read-only in D3 of every pack |

### Renamed / reworded
| Field | Change |
| :- | :- |
| B3 Domains and languages → **Domains and languages covered** | "Where it is thin" removed; gaps go in B5 |
| B5 Known weaknesses → **Known weaknesses and gaps** | Now the one place for quality gaps (N · Required) |
| D2 Disqualifiers | Help text: point to B2 Out of scope and B5 rather than restate them |
| B5 Bias findings | Help text by type: MT = gender, formality and register bias; LLM = fairness wording |
| C1 Language pairs, C2 Detection accuracy, C3 Hallucination | Help text: numbers belong in B4 |
| Pack versions v1, v2 → **Rev 1, Rev 2** | Everywhere, including the stored activity log, so they don't clash with model versions (B1/B8, e.g. v2.1) |

### Added
| Field | Tag | Notes |
| :- | :- | :- |
| B7 Data handling | P · Required | Hosting and processing location, runtime storage/logging and retention, sub-processors |
| B4 Results: Language pair / Scope column | — | "Scope" for non-MT models |
| B4 Results: Scale column | — | Dropdown: 0–1, 0–100, minutes, % (inferred on migration from the values; confirm it) |
| B4 Results: Re-validate by column | — | Defaults to Date measured + 6 months; past-date rows block launch |
| E Claims register: Source field column | — | Filled by "Create claim from this field"; links back to the field |
| A9 Request process | P | Factory-wide, on the factory fact sheet |
| N/A with reason | — | Any field; reason of at least 10 characters |

### Retagged
| Field | From | To |
| :- | :- | :- |
| D2 Common objections | N · Under NDA | I · Internal |

### Required fields (20)
B1 all five · B2 all four · B3 Sources, Customer data · B4 Results, Headline result ·
B5 Known weaknesses and gaps, Mitigations · B7 Data handling · D1 Packaging & pricing, SKU,
Margin · E Claims register (at least one claim). Everything else is Optional. The counter
now reads "Required: x/y · Optional: x/y". Part A (factory sheet) stays all-Optional.

### Launch-ready checks (lib/checks.ts)
Launch-ready = all four sign-offs on the published Rev **and** no blocking issues on it.

| Check | Blocks | Rule |
| :- | :- | :- |
| Missing required | Yes | Required field empty and not N/A with a 10+ character reason |
| Unregistered public claim | Yes | A Public text field (incl. B4 Headline) has a performance number (%, ± delta, COMET/chrF/BLEU score, minutes, pts) or a comparison word (faster, better, replaces, drop-in, vs) not contained in an **approved** claim (Evidence + Approved by filled). Dates, versions, specs and "100% TM matches" are ignored |
| Visibility conflict | Yes | A number in a Public field also appears in an NDA or Internal field (values, not labels, dates or scales), unless an approved claim contains it. Names the source field |
| Expired metric | Yes | A B4 row is past its Re-validate by date |
| Two products | Yes, until overridden | Custom Language Model + Custom Customer Model both active; override needs a 10+ character reason, saved with name and time |
| Scale mismatch | No (warning) | COMET/chrF on 0–1 in B4 but C4 Measured uplift uses integer deltas ("+3") without "points (×100)" |

"Create claim from this field" adds a pre-filled claims row with the field's text and a
link back to it.
