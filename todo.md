# Waris Genealogy App - TODO

- [x] Configure theme colors (Heritage Green/Gold palette)
- [x] Set up tab navigation (Home, Tree, Tools, Settings)
- [x] Add icon mappings for all tabs
- [x] Create data models and types for Person, Marriage, Relationship
- [x] Build AsyncStorage persistence layer (save/load family data)
- [x] Build Home screen with dashboard, stats, and quick actions
- [x] Build Add Member screen with full form (prefix, bin/binti, etc.)
- [x] Build Edit Member screen
- [x] Build Member Profile screen
- [x] Build interactive family tree visualization (SVG-based)
- [x] Build Tools screen with card menu
- [x] Build Faraid Calculator screen
- [x] Build Mahram Checker screen
- [x] Build Settings screen (collaboration, language, theme, export)
- [x] Build Invite Family screen (email-based collaboration)
- [x] Build role-based permissions (Admin, Editor, Viewer)
- [x] Generate custom app icon
- [x] Polish UI and test all flows
- [x] Fix: Date of Birth use calendar selector instead of text input
- [x] Fix: Prefix/Title use dropdown list instead of text input
- [x] Fix: Ethnicity - add "Bajau" after Melayu, remove "Orang Asli"
- [x] Fix: Add photo option in Add/Edit member
- [x] Fix: Relationship link selector in Add/Edit member (spouse, child, parent connection)
- [x] Feature: Photo support for family members (camera/gallery)
- [x] Feature: PDF export for family tree and Faraid reports
- [x] Feature: Search/filter on Home and Tree screens
- [x] Bug: Photo not saving after camera/gallery selection (only edit/crop/rotate shown, no save)
- [x] Feature: Family Timeline view (chronological births, marriages, deaths)
- [x] Feature: Backup/Restore via JSON export with Google Drive/Gmail sharing
- [x] Feature: Multi-language support (BM/English toggle)
- [x] Feature: Miller Columns view as alternative tree navigation
- [x] Feature: Tree node tap navigates to member profile
- [x] Feature: Profile button to set member as root and view their family tree
- [x] Feature: Zoomable family tree (pinch-to-zoom and zoom buttons)
- [x] Bug: Photo upload error from camera and gallery (fixed: use correct mediaTypes API for SDK 54)
- [x] Bug: Backup creation error (fixed: platform-safe FileSystem handling + web fallback)
- [x] Feature: Redesign import/export like Fuelio app Google Drive sync settings
- [x] Bug: Photo gallery picker crash - Fixed: added missing Platform/Alert imports, removed getPendingResultAsync
- [x] Bug: Google Drive send error - Fixed: proper error handling and imports
- [x] Bug: JSON export error - Fixed: proper FileSystem imports and null checks
- [x] Bug: Photo upload STILL failing - ROOT CAUSE: dynamic require() fails at runtime; fixed with static import from expo-file-system/legacy + base64 persistence
- [x] Bug: Photo picker crash - ExponentImagePicker native module incompatible with Expo Go; replace with document-picker (expo-image-picker removed, photos use expo-document-picker)
- [x] Bug: Google Drive import not working (parallel uploads created duplicate folders, restore picked the oldest file, session not restored after restart, restore needed an app restart)


## Major Redesign (Phase 2)

- [x] Fix: Photo upload - added Android permissions (READ_MEDIA_IMAGES, CAMERA, etc.)
- [x] Feature: CSV export with folder structure (photos, data, relationships)
- [x] Feature: CSV export button in Settings screen
- [x] Feature: Bottom tab bar on main screens (Home, Tree, Tools, Settings) via expo-router tabs
- [x] Feature: Family summary profile with tabs (Spouse, Parents, Grandchild, Great-grandchild)
- [x] Feature: Hierarchical card-based tree view (like reference APK)
- [x] Feature: Tree view with visible photos and connection lines
- [x] Feature: Zoomable/scrollable tree canvas
- [x] Feature: Google Drive auto-sync like Fuelio app (auto-backup 30s after edits when enabled and signed in)
- [x] Feature: Add child buttons on tree nodes
- [x] Bug: APK build fails - compileSdk android-34 too low, updated to compileSdk 36 / targetSdk 35
- [x] Feature: Change backup save format from JSON to CSV (Fuelio-style)
- [x] Feature: CSV restore/import functionality
- [x] Feature: Fuelio-style backup-restore UI with CSV files
- [x] Feature: Google Sign-In for Google Drive backup (like Fuelio)
- [x] Feature: Direct Google Drive API upload/download CSV (not share sheet)
- [x] Feature: Fuelio-style backup UI with Sign In/Sign Out, signed-in user display
- [x] Bug: Fix ExpoSharing.shareAsync error on Android (replaced with direct Drive API)
- [x] Feature: Create reusable skill for Google Drive CSV backup integration
- [x] Bug: APK crashes immediately on launch - removed expo-sharing (FilePermissionService incompatible with SDK 54)
- [x] Bug: APK still crashes - fixed expo-print/auth-session/crypto from v55 to SDK 54 compatible versions, removed unused expo-image-picker, added expo-font plugin
- [x] Bug: APK still crashes on launch after expo-sharing removal - fixed: version mismatch (v55 packages on SDK 54)
- [x] Update Google OAuth Client ID to new dedicated project
- [x] Bug: Google OAuth 'Access blocked' - fixed with server-side HTTPS proxy redirect at /api/google/callback
- [x] Update Google OAuth Client ID and Client Secret to new Android-type credentials (now uses EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
- [x] Feature: Export CSV shows SAF file picker so user chooses save location before saving
- [x] Fix: Complete server-side Google OAuth token exchange (server exchanges code, returns tokens to app)
- [x] Bug: Google Sign-In still blocked - OAuth access denied when user tries to sign in on Android APK (switched to native Google Sign-In)
- [x] Feature: Switch to Android-native Google Sign-In (Option A) using @react-native-google-signin/google-signin
- [x] Feature: Remove server-side OAuth callback dependency for Google Sign-In


## Simplify & Polish (Phase 3)

- [x] Simpler Home screen (welcome for new users, 3 shortcuts), shorter Add/Edit form with "More details"
- [x] Member profile as one scrolling page instead of 7 tabs
- [x] Invite Family opens email / share sheet with a ready-written message (was only saved locally)
- [x] "Back up first" option before Reset All Data
- [x] Year-only dates and typed year in the date picker
- [x] Full Bahasa Malaysia for Faraid, Mahram, Invite, Timeline, Tree
- [x] Tree: "Show parents" button to move the tree up a generation
- [x] GitHub Actions CI (type check, lint, tests)
- [ ] Add repository variable EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for CI (Settings > Secrets and variables > Actions > Variables)
- [ ] Confirm the Mahram "same gender" rule with a religious reference
