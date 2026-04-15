# Changelog

## [v2.0.0-alpha] - 2026-04-15

### Added
- 7 componente: role-badge, stats-row, party-card, modal, member-dropdown, toast, empty-state
- 3 utils: api.js, party-helpers.js, dom.js
- CLAUDE.md cu style guide
- Playground pentru testare componente

### Changed
- index.html: 7000 -> 4476 linii
- Extract smart-match.js (676 linii) — SM3 stats matching UI complet
- 55+ duplicate eliminate
- 30 alert() -> Toast
- 30+ fetch() -> apiGet/apiPost/apiPut/apiPatch/apiDelete
- 9+ inline role color objects -> roleColor()/roleHex()
- 4 party dot color arrays -> PARTY_DOT_COLORS
- 2 inline modals -> Modal.inline()
- 7 empty state blocks -> EmptyState()

### Next (v2.0.0)
- [x] Extract smart-match.js (676 linii)
- [ ] Extract war-view.js (~800 linii)
- [ ] Extract members.js (~700 linii)
- [ ] Extract settings.js (~600 linii)
- [ ] Extract new-war.js (~1500 linii)
- [ ] index.html target: ~800-950 linii
