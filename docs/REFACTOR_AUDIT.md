# Work Tracker readability and architecture audit

Review date: 2026-10-29. Source reviewed: `public/app.js`, `server.mjs`,
`public/styles.css`, `public/language.js`, `scripts/build.mjs`,
`task-signals.mjs`, and the existing Node tests.

**Scope:** Improve maintainability while preserving current behavior.
PM → Engineering requirements/design rules remain **Issue #2**, not part of this refactor.

## Findings

| Area                | Evidence                                                                                                                                                          | Next recommended step                                                                                                      | Risk                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Browser application | `public/app.js` is a roughly 7,000-line global script with 200+ named functions, 50+ `innerHTML` writes, and a mix of rendering, state changes, and network calls | Extract one screen or feature at a time (Engineering, PM, Quick Task, release planning, reporting) behind small interfaces | Medium–high: event delegation, global state, and script ordering |
| Server routing      | `server.mjs` is over 4,600 lines; the main `api()` function spans roughly 2,000 lines and handles many endpoints                                                  | Split route handlers by domain while keeping the public `handle(request, env)` contract and authorization checks intact    | High: permissions, transactions, deployed data                   |
| Styling             | `public/styles.css` is over 8,000 lines; many selectors recur in separate rules or media queries (e.g. `.topbar`, `.sidebar`, `.next-step-card`)                  | Document cascade layers and split by page/component in a dedicated CSS-only PR                                             | Medium–high: order and responsive overrides matter               |
| Templates           | The browser script contained 44 lines over 800 characters after initial formatting, many from nested template literals                                            | This branch reflows dense HTML literals and extracts selected state/presentation expressions                               | Low–medium: HTML content must remain identical                   |
| Build process       | `scripts/build.mjs` embedded a minified Worker entrypoint and repeated more than 30 migration `copyFile` calls                                                    | Use named build helpers and an explicit, ordered migration list (done in this branch)                                      | Low–medium: verify generated Worker and migration files          |
| Testing             | `tests/workflow.test.mjs` exceeds 11,000 lines and has repeated fixtures/VM source extraction                                                                     | Split tests by feature and reuse fixtures; prefer stable module interfaces over source-string slicing                      | Medium: avoid weakening assertions                               |
| Localization        | `public/language.js` mixes hundreds of UI strings, including some outdated PM Source wording                                                                      | Review labels and translations with the actual feature changes, especially Issues #2 and #3                                | Low–medium: user-visible wording                                 |

Counts are diagnostic approximations, not quality scores. Repeated CSS selectors may be
intentional responsive overrides; do not deduplicate them without cascade and viewport tests.

## Changes made in this readability branch

- Reflowed **278** oversized HTML template literals in two automated, source-preserving
  passes (179 + 99). The reflow tool verifies that adjacent fragments reconstruct the
  exact original template source before editing.
- Extracted clearer control flow for `urgentControls()` and reused a
  `pmReadinessItem()` helper to make the PM checklist easier to edit.
- Extracted `pmEditorGuidance()` so the PM modal no longer embeds a long nested
  conditional directly in its markup.
- Simplified Worker build generation into named functions and an explicit ordered
  migration list.
- Left historical SQL migration files, API validation, task transitions, permissions,
  and schema untouched.

**Remaining limitation:** Some template expressions are still dense even after reflow.
String splitting does not replace semantic component boundaries; deeper component
extraction belongs in separate, tested feature PRs.

## Safe follow-up order

1. **Complete Issue #2** in its own PR: optional Requirements, required Design, no
   duplicate Title in handoff, with focused behavior tests.
2. **Engineering and PM panels:** extract smaller pure renderers for workflow steps,
   actions, editor, discussion, and attachment sections; then check browser behavior.
3. **Quick Task and shared attachment behavior:** consolidate upload/save flows while
   addressing their existing issues; test paste, unsaved changes, and delete.
4. **Browser state and API layer:** separate fetching, mutations, and UI state from HTML.
5. **Server route modules:** take one domain at a time with permission/rollback tests.
6. **CSS and test structure:** reorganize without changing precedence or assertions.

## Verification expectations

For a readability-only PR, run `npm run format:check`, `npm test`,
`node scripts/build.mjs`, and `node --check dist/server/index.js`.
Before merge, manually check the Engineering, PM, and Quick Task panels on
desktop and mobile sizes. These checks do **not** replace a real browser test
suite; a passing Node test suite does not prove every UI interaction is correct.

Do not mix these structural improvements with feature business-rule changes.
