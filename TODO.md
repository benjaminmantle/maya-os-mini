# Maya OS — TODO

Items are added here for tracking. Do not act on these without explicit direction.
Mark items [x] when done — do not delete them.

---

## Multi-device & Mobile

- [ ] **Responsive layout / other devices** — audit how the app looks and behaves on non-desktop screen sizes (tablet, small laptop, large monitor). Fix layout breakages, overflow issues, and anything that looks broken or cramped.

- [ ] **Mobile usability (full setup)** — make the app genuinely usable on phone, not just technically functional. This includes: touch-friendly tap targets, no hover-only interactions, readable text without zooming, mobile-appropriate layout, and getting the app actually accessible on your phone (PWA/home screen install, or hosted, or another access method — TBD).

---

## CosmiCanvas Phase 5

- [ ] **Alignment guides** — snap lines when dragging elements near other elements' edges/centers. Visual guide lines.
- [ ] **Additional render styles** — watercolor, blueprint, neon, etc. New style modules in `render/styles/`.
- [ ] **Performance for large boards** — virtual rendering (only draw visible), spatial index tuning, throttle store notifications during drag.
- [ ] **Multi-board tabs** — open multiple boards simultaneously with tab bar.
- [ ] **Touch support** — touch events for mobile/tablet (pinch zoom, two-finger pan, tap to select).
