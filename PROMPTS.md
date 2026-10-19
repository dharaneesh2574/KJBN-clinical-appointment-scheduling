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
