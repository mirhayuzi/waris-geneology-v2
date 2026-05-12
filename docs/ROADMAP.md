# Waris Genealogy — Project Roadmap

**Status as of May 2026** — single-user local-first Malaysian Muslim genealogy app.

## Product Direction (locked decisions)

| Decision | Choice | Rationale |
|---|---|---|
| Sync architecture | **Local-only forever** | Privacy-first, simple, no backend cost |
| GEDCOM support | **Skip** | Niche feature, not target audience priority |
| Target tree size | **No limit (design for scale)** | Must support 2000+ member clans |
| Monetization | **RM100 lifetime, freemium 50-member limit** | Free trial = trust, natural conversion point |
| Platform priority | Android first (Play Store) | iOS later if traction |

## Completed (✅ shipped)

| Phase | Feature | Build |
|---|---|---|
| 1 | SQLite migration (from AsyncStorage) | #3 |
| 1.5 | ZIP backup + Google Drive sync | #6 |
| 1.5C-mahram | Mahram bug fix (Nasab/Musaharah detection) | ✅ |
| 1.5C-toolbar | Bottom tab persistence in tool screens | ✅ |
| 1.5C-search | PersonSearchSelector (initial — Mahram + Faraid) | ✅ |
| 1.5E | Per-profile family PDF export (A4) | ✅ |
| 1.5E.1 | Search picker everywhere + PDF marriage grouping | ✅ |
| 1.5E.2 | Keyboard overlap fix (search results visible) | ✅ |
| 1.5D | Full relationship taxonomy (33 labels, 70 tests, dual-perspective UI) | ✅ |
| 1.5F | 4 production bug fixes (delete crash, pupu rename, redundant tools, Faraid home route) | 🚧 In progress |

---

## Phase 2 — Pre-Launch Production Hardening 🛡️

**Goal:** Make the app Play-Store-listable. Currently it cannot be listed publicly.

### Scope
- [ ] Bundle ID rename: `space.manus.waris.genealogy.t20260312144942` → `com.mirhayuzi.warisgenealogy`
- [ ] Privacy Policy (BM + EN) — host on GitHub Pages or similar
- [ ] Terms of Service (BM + EN)
- [ ] Google OAuth verification — publish OAuth app, exit Testing Mode
- [ ] **Fix Google Drive sync token error** (critical — local-only means backup is the only safety net)
- [ ] Crash reporting setup (Sentry free tier)
- [ ] Production EAS build profile (separate from preview)
- [ ] App icon finalization (1024×1024 + adaptive)
- [ ] Splash screen polish
- [ ] App permissions audit (only ask for what's needed)

### Estimated effort
3-5 focused sessions. Mix of code + non-code work (writing policies, OAuth dashboard config).

### Definition of done
App can be uploaded to Play Console as a closed internal test build, passes Play Store policy compliance checks.

---

## Phase 3 — Scale Hardening 📈

**Goal:** Make the app fast for 500+ and viable for 2000+ member trees.

### Scope
- [ ] Add closure table schema (`person_closure`: ancestor_id, descendant_id, depth)
- [ ] Add SQL triggers to keep closure table in sync on parent_child changes
- [ ] Migrate `lib/relationships.ts` query layer to use closure table joins (KEEP all 33 labels + 70 tests passing — only swap the traversal engine)
- [ ] Add FTS5 virtual table for full-text search (first_name, nickname, bin_binti, last_name, birth_place, death_place, bio, occupation)
- [ ] Build search screen `app/(tabs)/search.tsx` with FTS-backed query
- [ ] Add missing Malaysian schema fields:
  - `nickname` (Pak Long, Cik Yah)
  - `mother_name` (untuk nasab lengkap)
  - `occupation`
  - `origin_state` (negeri asal)
  - `burial_place`
  - `wife_number` on marriages (for poligami structure)
  - `soundex_name` (auto-computed for fuzzy search)
- [ ] Photo storage: ensure photos use `photo_uri` pointing to `expo-file-system`, NOT base64 blobs
- [ ] List pagination on member list views (`FlatList` + `getItemLayout` + 50/page)
- [ ] Lazy tree expansion on tree view (default 2 generations from root)

### Files to reuse from waris-improvements.zip
- `schema.sqlite.ts` — adopt the extended schema
- `schema-triggers.sql` — closure table triggers
- `app-search.tsx` — adapt for FTS5 search screen
- `relationships.ts` — REFERENCE for closure-table query patterns, NOT for relationship logic (current version is more complete)

### Estimated effort
6-10 sessions. Biggest engineering lift remaining.

### Definition of done
Mahram Checker still works correctly with closure-table backend. Search returns results in <100ms on a 2000-row synthetic dataset.

---

## Phase 4 — Polish & Backup Hardening 🛟

**Goal:** Make the app daily-use reliable. Local-only means backup is the safety net — must be bulletproof.

### Scope
- [ ] Auto-backup scheduling (daily ZIP to Google Drive, configurable)
- [ ] Multi-backup retention (keep last 7 dated snapshots)
- [ ] Backup restore tested under failure cases (interrupted restore, corrupted ZIP, missing media)
- [ ] Duplicate detection on add-member:
  - Soundex match on first_name + bin_binti + gender + birth_year decade
  - Show "Mungkin duplicate dengan: X" warning, allow override
- [ ] Tags system (member can have tags: "Sebelah Ayah", "Sebelah Ibu", "Kampung Pendang")
- [ ] Tag-based filter on tree/list views
- [ ] Audit-log-lite: `last_edited_at` + `last_edited_by` (just timestamp; "by" matters less for single-user)
- [ ] Branch collapse detection: warn when adding marriage between two members who share an ancestor (cousin marriage — relevant for Faraid downstream)

### Estimated effort
3-5 sessions.

### Definition of done
A power user can rely on the app for their actual family records without fear of data loss or duplicates.

---

## Phase 5 — Play Store Launch + Monetization 🚀💰

**Goal:** First public release with paid tier.

### Scope
- [ ] Play Store listing assets:
  - Feature graphic
  - 6-8 screenshots (BM + EN versions)
  - Short + long description (BM primary, EN secondary)
  - Promo video (optional)
- [ ] Free tier enforcement: 50-member soft limit, friendly "Upgrade untuk tambah lagi" prompt at member 51
- [ ] Google Play Billing integration for one-time RM100 unlock product
- [ ] License verification (offline-capable — local-only stays local-only)
- [ ] Internal testing track (5-10 testers, family + friends)
- [ ] Closed beta (20-50 users)
- [ ] Production rollout
- [ ] Support email setup (e.g., support@warisgenealogy.my or Gmail)
- [ ] Simple landing page (one-pager with download link + privacy policy + ToS)

### Estimated effort
4-6 sessions + waiting for Play Store reviews (24-72 hours per submission).

### Definition of done
App is downloadable on Google Play. RM100 purchase unlocks unlimited members. At least 1 paying user (or yourself testing the purchase flow end-to-end).

---

## Phase 6+ — Optional Future Features 🌟

Nice-to-have, NOT scoped or scheduled. Pull from this list when Phases 2-5 are done and market signals demand.

- Hijri calendar overlay alongside Masihi dates (kelahiran, kematian, khatam, haji)
- QR code per member (share at kenduri/raya — scan to add to your tree)
- Family timeline events table (khatam Quran, haji, umrah, milestone events)
- Geocoded family map (lat/lng on birth_place → visualize family origins on Malaysia map)
- AI-assisted bio generation (Claude API integration for "tulis bio ringkas berdasarkan info ini")
- Regional dialect labels (Pak Long vs Pak Cik depending on user's setting)
- iOS launch (post-Android traction)

---

## Out of Scope (Permanently)

To prevent scope creep, the following are explicit non-goals:

- ❌ **Real-time sync / cloud sync / multi-device** — local-only by design
- ❌ **Multi-user collaboration / family workspaces** — privacy-first single user
- ❌ **GEDCOM import/export** — niche, not target audience
- ❌ **Server backend** — no infrastructure to maintain
- ❌ **Subscription pricing** — RM100 lifetime decision is final
- ❌ **Social features** (comments, activity feed, notifications) — privacy-first
- ❌ **Public family trees / sharing** — privacy-first

---

## File Reuse from waris-improvements.zip (April 2026)

The April 2026 improvement pack was prepared assuming a different product direction (multi-user sync). With current decisions locked, this is the reuse map:

| File | Use in | Note |
|---|---|---|
| `schema.sqlite.ts` | Phase 3 | Adopt extended schema |
| `schema-triggers.sql` | Phase 3 | Closure table triggers |
| `app-search.tsx` | Phase 3 | Adapt for FTS5 search screen |
| `relationships.ts` (pack) | Phase 3 | Reference only — current version has 33 labels + 70 tests; adopt closure-table query pattern, keep label logic |
| `lib-db-client.ts` | Phase 3 | Reference — compare to current Phase 1 setup |
| `family-store-v2.tsx` | Phase 3 | Reference only |
| `app-relationship-finder.tsx` | Skip | Mahram Checker already serves this purpose |
| `lib-db-migrate.ts` | Skip | Phase 1 already migrated |
| `server-schema-sync.ts` | **DELETE** | No server architecture |
| `lib-sync.ts` | **DELETE** | No sync |
| `lib-gedcom.ts` | **DELETE** | No GEDCOM |

---

## How to Use This Document

1. **Start of every session** — read this file first if returning after a break
2. **Phase complete** — mark items ☑️ and update build numbers
3. **New feature idea** — add to Phase 6+ list; do NOT inject into current phase
4. **Scope creep temptation** — re-read "Out of Scope" section
5. **Phase decisions change** — update the "Product Direction" table at top

---

## Document History

- **2026-05-12**: Initial roadmap created after Phase 1.5F. Synthesizes April 2026 improvement pack with locked product decisions.
