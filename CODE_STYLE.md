# Code style and readability

Work Tracker is maintained for **people to read, review, debug, and extend**. Formatting is a baseline, not a substitute for clear code structure.

## Daily workflow

- Use Node.js 22.13 or later.
- Run `npm install` once, `npm run format` before committing, and `npm run format:check` to verify formatting.
- Run `npm test` and `node scripts/build.mjs` before opening a pull request.
- Prefer a small, focused PR with a clear before/after behavior check. Never combine formatting, renames, and business logic changes in a single review without explanation.

## JavaScript

- Use descriptive parameter and variable names in new or substantially edited code. Avoid unexplained abbreviations.
- Keep conditionals and statements on separate lines. Use early returns for exceptional or empty states.
- Put data selection, validation, state changes, and HTML rendering in distinct functions where practical.
- Extract complex task-panel sections into named rendering helpers. Avoid a whole page represented by one giant template-string line.
- Escape user-provided text using the existing `e()` / `escapeHTML()` boundary. Do not insert raw user data into HTML.
- Keep authorization and workflow checks on the server; client checks only improve presentation.

## UI templates

- Prefer small named functions such as `renderTaskDescription(task)` and `renderTaskAttachments(details)` over deeply nested `${... ? ... : ...}` expressions.
- Align HTML nesting and keep each meaningful element on its own line when editing a template.
- Avoid changing rendered text/whitespace or event selectors during formatting-only passes; verify browser behavior after structural refactors.

## SQL and historical data

- Do **not** rewrite applied files in `migrations/`. Create a new migration for schema changes.
- Keep query parameters bound, rather than interpolating input into SQL strings.

## Scope of the readability pass

- Mechanical formatting is a first pass, not a claim that every large renderer has been decomposed.
- Follow-up structural refactoring should be separated into reviewed commits, with equivalent behavior tests.
