# AI prompt log

Requests below are ordered from the available conversation evidence. Items 1–3
were recovered from the scaffold conversation; their dates use its environment
context. No unavailable prompts or tool results are invented.

## 1. Repository scaffold hygiene

- Date: 2026-10-18 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop.
- Prompt (verbatim):

  > in this directory I have frontend and backend apps i need you to scaffold commit it by configuring the gitignore for relevant practices like removing package files and everything and perform a commit and push to repository

- Outcome: Added root ignore rules and backend scaffold; retained manifests and
  lockfiles for reproducible installation; committed and pushed `9d45677`.

## 2. Commit confirmation

- Date: 2026-10-18 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop.
- Prompt (verbatim):

  > did you commit ?

- Outcome: Confirmed `9d45677` and its push to main; no file changes.

## 3. Single repository and Prisma

- Date: 2026-10-18 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop.
- Prompt (verbatim):

  > no you have a single repository at rrot of thes chat there os no backend specific repo remo ve them add git ignore to main project folder and also add configure prisma orm in backend

- Outcome: Confirmed one root repository, removed redundant frontend ignore file,
  and configured PostgreSQL/Prisma 7 with NestJS lifecycle in `c5cc50f`.

## 4. Project guidance from assignment PDFs

- Date: 2026-10-18 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop.
- Sources supplied: `KJBN_Internship_Common_Instructions_and_Evaluation.pdf` and
  `KJBN_Internship_Problem_2.pdf`.
- Prompt (verbatim):

  > with the create Agents.md file with project knowledge form these sources
  > and we have selected React and NestJs as backend scaffold we will go with a PostgreSQL
  > connected with prismaORM
  > and mention the milestones and follow them and the structure for deliverables
  >
  > focus mainly on backed coding standards
  > follow SOLID Principles by rules in agents

- Outcome: Used to create `AGENTS.md` with source requirements, selected stack,
  backend/SOLID rules, milestone gates, and deliverable formats; no application
  business logic was implemented in this step.

## 5. M1, Docker, and initialized configuration

- Date: 2026-10-19 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop; domain-modeling skill; official Prisma,
  PostgreSQL, and Docker documentation consulted.
- Prompt (verbatim):

  > we have to procede with M1 to modal the domain with all the entities mentioned
  > also setup docker frontend and backend as a container and write a docker compose at root level to run those images under dharaneesh2574/*
  > and also setup the config class in backend to read from env which should also be initialized

- Use note: Complete/verify M0 first, model M1 entities/migrations/seed and explicit
  decisions, then add the explicitly requested container subset of M5 early.
  Verification and final milestone hashes are recorded in README/SUBMISSION.

- Verified outcome for request 5: M0 configuration committed as `c9a3346`; M1
  domain/migration/seed committed as `7e795de`. 25 unit tests, 10 real-PostgreSQL
  tests, and the mocked HTTP check pass; 35 behavioral acceptance cases are TODO
  for M2. Docker images were built locally under `dharaneesh2574/*`; full-stack
  startup, nginx API proxy, allowed/excluded CORS origins, explicit seed helper,
  and schema consistency were verified. Root `.env` was initialized from the
  local example and remains ignored. No images or hosted application were published.

## 6. Explain Docker roles and reserve Git actions for the user

- Date: 2026-10-19 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop.
- Prompt (verbatim):

  > why is there like 4 - 5 images seperate one for each seed integration
  > is it necessary explain it to me
  > and do not commit at the end
  > complete all tasks the commit will be done by me manually
  > so add it as a rule in agents.md

- Outcome: Explained the four distinct images and shared tooling image used by
  migration, seed, and integration services. Added a required manual Git workflow
  to `AGENTS.md` and aligned milestone commit guidance. Docker files were unchanged;
  changes were left unstaged and uncommitted, with no push.

## 7. Build a project knowledge graph

- Date: 2026-10-20 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop; graphify skill.
- Prompt (verbatim): `[$graphify](/Users/dharaneeshnatarajan/.codex/skills/graphify/SKILL.md)  .`
- Use note: Apply the supplied graphify skill to the current repository, producing
  an interactive HTML graph, graph data, and an audit report in `graphify-out/`.
  Application implementation and Git commits are outside this request.

## 8. Require graphify for project context

- Date: 2026-10-20 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop; graphify skill.
- Prompt (verbatim):

  > Update the Agents.md to use [$graphify](/Users/dharaneeshnatarajan/.codex/skills/graphify/SKILL.md)  when processing a prompt regarding the project
  > if need any reference use this&#x20;
  > read `graphify-out/GRAPH_REPORT.md` and query `graphify-out/graph.json` for project context instead of scanning raw files first.

- Outcome: Used the existing report and graph query to check guidance, then added
  a required graphify workflow to `AGENTS.md`, with targeted source verification
  and explicit handling of missing/stale graph context. No graph rebuild or Git
  commit was performed for this documentation change.

## 9. Implement M2 business rules

- Date: 2026-10-20 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop; graphify skill; local TypeScript/Jest and PostgreSQL tooling.
- Prompt (verbatim): `now implement the M2 milestone`
- Use note: Verify preceding gates, implement R1–R7 policies and protected use cases,
  replace acceptance TODOs with executable checks, and record real-PostgreSQL
  concurrency/rollback evidence. Keep HTTP/UI work for later milestones and leave
  all changes unstaged and uncommitted for manual review.

- Verified outcome for request 9: M2 R1–R7 policies, protected use cases, Prisma
  adapters, status events, availability/doctor edit protection and clock snapshots
  are implemented. The full gate passes 99 unit/acceptance, 1 existing HTTP smoke,
  and 30 real-PostgreSQL tests. Business-code line coverage is 96.76%; overall
  backend unit/acceptance line coverage is 73.16%. Build, typecheck, read-only lint
  and Prisma validation pass. The actual lock-timeout test exposed and verified
  correction of Prisma 7's nested SQLSTATE handling. HTTP/UI remain M3/M4;
  changes are left unstaged and uncommitted. Graph context is refreshed separately
  below, without treating inferred graph relationships as implementation proof.

## 10. Refresh the project graph incrementally

- Date: 2026-10-20 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop; graphify skill.
- Prompt (verbatim): `[$graphify](/Users/dharaneeshnatarajan/.codex/skills/graphify/SKILL.md)  --update`
- Use note: Detect changed/deleted sources against the existing manifest, update
  only changed extraction, preserve stable graph identities and confidence labels,
  regenerate the graph/report/HTML as needed, and retain integrity warnings.
  Application code and Git staging/commits are outside this request.

## 11. Implement M3 API

- Date: 2026-10-20 (Asia/Kolkata).
- Assistant/tool: OpenAI Codex desktop; graphify skill; NestJS official documentation; local TypeScript/Jest and PostgreSQL tooling.
- Prompt (verbatim): `Proceed with M3 — API | Core endpoints; DTO validation; consistent errors; structured request logging; request clock; OpenAPI; passing API tests. | Not started |`
- Use note: Verify the M2 foundation, expose core feature endpoints through validated
  DTOs and explicit response mappings, add safe errors/correlated logs and a
  request-isolated reviewer clock, generate OpenAPI, and verify real HTTP workflows.
  Leave implementation/docs unstaged and uncommitted; UI remains M4.

- Verified outcome for request 11: core API routes, strict nested DTOs, explicit
  responses, consistent safe errors, one correlated JSON log per request,
  configuration-bound request clocks and OpenAPI are implemented. 214 tests pass
  (113 unit/acceptance, 1 smoke, 70 real-DB API and 30 other real-DB); combined line
  coverage is 97.48% overall / 97.91% business. Build/typecheck/lint/schema checks
  pass. A new DOB migration reconciles database bounds with reviewer-time policy;
  actual duplicate-phone tests verified Prisma constraint translation. UI remains
  M4. Existing user staging is preserved; no Git add/commit/push was performed.

## 12. Suggest the M3 commit message

- Date: 2026-10-20
- Tool: OpenAI Codex desktop
- Prompt (verbatim): `give a commit message for this milestone`
- Use note: Supply a Conventional Commit subject/body; do not stage or commit.
- Outcome: Suggested `feat(api): [M3] implement clinic scheduling API`; the user's
  subsequent manual commit exists as `f07683a`.

## 13. Implement M4 UI

- Date: 2026-10-20
- Tool: OpenAI Codex desktop
- Prompt (verbatim): `proceed with milestone 4`
- Use note: Build the required React flows against the M3 API, with explicit IST
  display, explained patient flags, responsive layouts and failure states. Verify
  real API browser workflows and preserve the user's manual Git workflow.
- Outcome: Implemented live schedules/booking/rescheduling, patient registration/
  lookup/history/flags/profile edits, today’s queue/statuses, doctor/hours controls,
  IST display and request-local reviewer-time controls. Strict build/lint and all
  18 Playwright cases pass against isolated real PostgreSQL/API; preceding 214
  backend tests pass again. Browser checks exposed and corrected mobile grid width
  and dialog focus restoration; earlier fixture/selector failures were corrected.
  Production nginx/API navigation was inspected without mutating clinic records.
  M3's actual manual commit is `f07683a`; M4 changes remain for manual commit.
  User-staged lockfile removals are preserved and their install impact is documented.
