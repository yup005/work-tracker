# Work Tracker

English | [简体中文](README.zh-CN.md)

Work Tracker is a web application for personal work tracking, shared task coordination, engineering and QA workflows, and release planning.

## Features

- **Dashboard:** daily activity summaries and next actions.
- **Daily Work:** private projects, tasks, recurring tasks, activity notes, and attachments.
- **Shared task board:** Engineering, PM, and Quick Tasks with search, filters, categories, and card or list views.
- **PM handoff:** requirements, design references, and handoff history remain attached to the same task as it moves into Engineering.
- **Engineering and QA:** stage transitions, feasibility review, estimates, QA rounds, feedback, and production delivery records.
- **Release planning:** current and future plans, task selection, and historical release snapshots. This is application release tracking, not Git repository management.
- **Workload views:** dated work activity, participation, and QA returns.
- **Access controls:** account administration and explicit work group membership. Administrative privileges and Engineering/QA owner eligibility are separate.
- **History:** activity revisions, audited corrections, archive/restore actions, and controlled workflow undo.
- **Language support:** English by default, with account-controlled Chinese translations for system guidance. User-authored content remains unchanged.

## Technology

- Frontend: HTML, CSS, and JavaScript.
- Backend: JavaScript HTTP API using standard Request and Response objects.
- Hosted runtime: Cloudflare Workers.
- Hosted database: Cloudflare D1, accessed through the `DB` binding.
- Hosted file storage: Cloudflare R2, accessed through the `BUCKET` binding.
- Local preview: Node.js, SQLite, and local file storage.
- Tests: Node.js built-in test runner.

## Requirements

Use Node.js 22.13 or later, with built-in `node:sqlite` support available. The current package declares no third-party runtime dependencies.

## Local preview

From the application root:

```sh
npm run dev
```

Open `http://127.0.0.1:4173` in your browser.

To use another port:

```sh
PORT=4174 npm run dev
```

The preview creates a local SQLite database and file storage directory and uses seeded demonstration accounts. It uses development authentication and is intended for local evaluation, not production hosting. Local preview data is separate from hosted application data.

## Project structure

```text
public/                 Frontend assets
server.mjs              Application API and business rules
node-server.mjs         Local preview server and storage adapters
schema.sql              Base database schema
migrations/             Incremental database migrations
scripts/build.mjs       Worker build and migration packaging
tests/                  Automated tests
package.json            Runtime requirements and commands
```

## Tests

```sh
npm test
```

The test suite covers application workflows, authorization, account sessions, attachments, and language behavior. Passing these tests does not replace hosted integration and browser verification.

## Deployment considerations

The hosted implementation expects a Worker runtime, a D1 database, and an R2 bucket. Deployment requires configuring those resources, applying database migrations, serving frontend assets, and supplying account initialization and runtime configuration.

The existing local preview is not a production deployment adapter. Running on another server platform requires adapting database and file storage access and providing a production server entry point. Initial administrator setup also needs review: the current hosted setup expects trusted upstream identity headers, which must never be accepted directly from untrusted clients.

The source package retains database and storage binding declarations without an existing hosted project identity. It is not a turnkey deployment package for arbitrary platforms.

Preserve existing migration history when upgrading an installation. Add new migrations instead of rewriting migrations already applied to a database.

## Data and configuration

Keep credentials, runtime environment files, databases, and uploaded files outside version control. The local preview writes:

- `work-tracker-local.sqlite`
- `.local-files/`

For SQLite, also exclude journal, WAL, and shared-memory files from source distributions. Configure administrator and optional integration settings for each installation; do not commit real account details or access tokens.

Private Daily Work is restricted to its owner and authorized read-only management access. Shared tasks follow work group and ownership rules. Preserve these boundaries when changing authentication or storage adapters.
