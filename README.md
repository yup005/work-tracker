# Work Tracker

Published Site: https://work-tracker-team.flowmddata.chatgpt.site

## Accounts
Email and password authenticate via a hashed server-side session with a Secure, HttpOnly, SameSite cookie. Passwords use salted PBKDF2-SHA256; login attempts are limited. API writes require a same-origin request. ChatGPT identity does not grant workspace access after this update. Initial owner password setup verifies the existing Sites owner identity once; normal login uses only the independent account. Admin can set passwords for invited team members in Team Access. Admin and QA work groups remain separate. Zoey is the owner display name; Admin is an authorization role, not the profile label.

## Privacy
Private Daily Work is visible to its owner and the read-only Boss. Admin does not gain access to other staff private work. The Engineering Board and its activity are shared. Member password reset invalidates previous sessions. Credentials and sessions are omitted from application exports.

## Verification
Run npm test for API, authorization, password/session and attachment tests. Run node scripts/build.mjs to build the Worker and migrations. Never change an applied migration; append a new migration under migrations and include it in the build. Hosted bindings are DB and BUCKET. Real browser sign-in and hosted persistence need separate verification.
