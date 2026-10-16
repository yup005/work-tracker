# Work Tracker

English | [简体中文](README.zh-CN.md)

A web application for personal work records, shared tasks, Engineering and QA workflows, and release planning.

## Features

- Dashboard summaries, next actions, and dated activity.
- Private projects, recurring tasks, work notes, and attachments.
- Shared Engineering, PM, and Quick Tasks with filters and card/list views.
- PM handoffs, PR review, QA rounds, linked feedback replies, and production delivery.
- Release plans and historical snapshots; this is application release tracking, not Git management.
- Workload views, task identifiers, urgency signals, and reminders.
- Account administration, explicit work group membership, read-only management access, and audited history.
- English interface with account-controlled Chinese system guidance.

## Local preview

Use Node.js 22.13 or later with built-in `node:sqlite` support.

```sh
npm run dev
```

Open `http://127.0.0.1:4173`. The preview creates a local SQLite database and `.local-files/`, uses seeded demonstration accounts and development authentication, and is intended for local evaluation only.

## Validation

```sh
npm test
node scripts/build.mjs
```

The build produces Worker output and database migration files in `dist/`. Browser and hosted integration verification are separate from automated tests.

## Source layout

- `public/`: HTML, CSS, JavaScript, and image assets.
- `server.mjs`: HTTP API, permissions, and business rules.
- `task-signals.mjs`: task signal calculations.
- `node-server.mjs`: local preview and storage adapters.
- `schema.sql` and `migrations/`: database schema and incremental migrations.
- `scripts/`: build tooling.
- `tests/`: automated tests.
- `maintenance/`: database checkpoint and recovery notes.

## Deployment and data

The hosted implementation uses Cloudflare Workers, D1 (`DB`), and R2 (`BUCKET`). Configure resources, frontend assets, account initialization, and runtime settings for your own installation. The included binding declarations contain no existing project identity.

This is not a turnkey deployment package for arbitrary platforms. Other server environments require storage adapters and a production server entry point. Initial administrator setup expects trusted upstream identity headers; never trust identity headers supplied directly by clients. The local preview must not be exposed as a production server.

Preserve applied migrations and add new ones for schema changes. Keep credentials, environment files, SQLite databases and sidecar files, and uploaded files outside version control. Infrastructure checkpoints may contain private and authentication data and must remain within the database access boundary.

Private Daily Work is restricted to its owner and authorized read-only management access. Shared tasks follow work group and ownership rules; administrative privileges do not automatically grant Engineering or QA owner eligibility.
