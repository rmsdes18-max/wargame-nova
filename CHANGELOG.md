# Changelog

## [v2.0.0] - 2026-04-15

### Added
- 7 componente: role-badge, stats-row, party-card, modal, member-dropdown, toast, empty-state
- 3 utils: api.js, party-helpers.js, dom.js
- 5 page modules: smart-match.js, war-view.js, members.js, settings.js, new-war.js
- CLAUDE.md cu style guide
- Playground pentru testare componente

### Changed
- index.html: 7000 -> 897 linii (shared state + HTML only)
- Extract smart-match.js (676 linii) — SM3 stats matching UI
- Extract war-view.js (860 linii) — wars list, viewWar, drag-drop, edit mode
- Extract members.js (887 linii) — roster page, CSV import, member profile, aliases
- Extract settings.js (477 linii) — auth, guild management, guild settings, users
- Extract new-war.js (1377 linii) — wizard steps 1-5, vision/OCR, save
- 55+ duplicate eliminate
- 30 alert() -> Toast
- 30+ fetch() -> apiGet/apiPost/apiPut/apiPatch/apiDelete
- 9+ inline role color objects -> roleColor()/roleHex()
- 4 party dot color arrays -> PARTY_DOT_COLORS
- 2 inline modals -> Modal.inline()
- 7 empty state blocks -> EmptyState()

### Next (v2.0.0)
- [x] Extract smart-match.js (676 linii)
- [x] Extract war-view.js (860 linii)
- [x] Extract members.js (887 linii)
- [x] Extract settings.js (477 linii)
- [x] Extract new-war.js (1377 linii)
- [x] index.html target: ~800-950 linii -> actual: 897 linii
