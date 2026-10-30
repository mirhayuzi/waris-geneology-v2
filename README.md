# Waris — family tree

A simple, private family tree app for Malaysian families. Everything is stored on the phone in SQLite. No account, no login, no server, no internet needed.

## What it does

- **Tree view** — your family around one person: parents and grandparents above (father's side left, mother's side right), spouses beside, children and grandchildren below. Pan with one finger, pinch to zoom, double-tap to zoom in. Tap anyone to move the tree to them; tap the centre person to open their profile. "Add Father / Mother / Spouse" boxes fill the gaps.
- **Malay naming** — bin/binti filled in from the father's name, titles (Haji, Syed, Dato' …), nicknames.
- **Partial dates** — `12/3/1982`, `3/1982`, `1982` or `~1950` (about).
- **Relationship finder** — how any two people are related, in Bahasa Melayu and English: bapa, datuk, moyang, sepupu, dua pupu, bapa saudara, anak saudara, abang/kakak/adik, ipar, mertua, menantu, biras, tiri, angkat, susuan, and cousin marriages ("husband · also first cousin").
- **Relationship types** — birth, adopted, step, foster and milk (susuan) parents; married / divorced / widowed, several wives.
- **Backup** — one `.json` file with the whole tree and every photo. Save it to Google Drive or a computer, restore it on a new phone. Old Waris backups (JSON) can be restored too.
- **GEDCOM export** — the standard format for FamilySearch, MyHeritage, Ancestry and Gramps (can hide living people).
- English / Bahasa Melayu, light and dark mode.

## Upgrading from the previous version

On first launch the app moves the old data (AsyncStorage) into the new SQLite database, including photos, and shows a message with the number of people moved. The old data is left in place as a safety copy. The Android package id is unchanged so the update installs over the old app.

## Project layout

```
app/                 screens (expo-router)
  index.tsx          tree view
  person/[id].tsx    profile
  edit.tsx           add / edit a person, add a relative
  union.tsx          edit a marriage
  people.tsx         searchable list
  relate.tsx         relationship finder
  settings.tsx       family name, language, backup, GEDCOM
components/          TreeCanvas (pan/zoom), TreeCard, Avatar, UI pieces
lib/
  model.ts           Person, Union, ParentLink
  repo-sqlite.ts     SQLite storage + schema migrations
  graph.ts           family queries (parents, siblings, ancestors …)
  layout.ts          tree layout
  kinship.ts         relationship names (BM + EN)
  actions.ts         add-relative rules (no loops, one birth father/mother …)
  backup.ts gedcom.ts legacy.ts dates.ts i18n.ts
```

## Develop

```bash
pnpm install
pnpm start          # Expo Go / dev build
pnpm test           # unit tests (layout, kinship, dates, backup, migration)
pnpm check && pnpm lint
```

The web build (`pnpm web`) is a preview only: it uses a sample family in memory and nothing is saved.

To build locally instead: `npx expo prebuild -p android` then `cd android && ./gradlew assembleRelease`.

## Getting the APK

Every push to `main` builds a signed APK on GitHub and puts it on the Releases page:
**https://github.com/mirhayuzi/waris-geneology-v2/releases/latest** — open it on the phone and tap the `.apk`.

Signing: `signing/waris-release.p12` is the app's signing key, protected by a password that is stored only
as the repository secret `ANDROID_KEYSTORE_PASSWORD`. Keep that password safe: without it, future builds can't
update the installed app.
