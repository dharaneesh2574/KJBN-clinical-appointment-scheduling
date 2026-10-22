# M6 — documentation and release verification

Date: 2026-10-20. Status: documentation and local release preparation verified;
full M5/M6 exit gates remain incomplete. Source requirements are recorded in
AGENTS.md. User Git choices and project assumptions are distinguished below.

2026-10-22 follow-up: the user-selected VM UI/API and fresh seeded database are
live; [VM evidence](vm-deployment.md) records registry digests, public checks and
data preservation. The deployment application source is local commit `c199607`,
where both lockfiles and verification Compose are tracked. Historical baseline
and failed-clone findings below describe `eff65d8`; the final committed clone,
complete hosted boundary matrix, current remote CI and release tag still need
verification. VM configuration/documentation changes await manual commit.

## Baseline and actual history

- Local and remote HEAD are `eff65d8` (2026-10-20), the user's M5 implementation
  commit. It also includes the M4 calendar/dashboard follow-ups. A commit's label
  alone does not prove hosted deployment completion.
- M0 `c9a3346`; M1 `7e795de`; M2 `ecdbbe0`; M3 `f07683a`; M4 `9197ec5`.
  Existing messages/history were retained rather than relabelled or rewritten.
  Some M2/M4/M5 subjects do not match the documented Conventional Commit/[Mx]
  convention; this is a remaining history limitation, not retroactively repaired.
- At the start of M6, `docker-compose.ui-test.yml` had an unstaged readiness
  change and `docker-compose.verify.yml` was untracked. Both were preserved.
- No files were staged, committed or pushed by this task. No `v1.0` tag exists.
  A release tag must identify the final verified commit, not the current pre-M6
  revision while documentation/configuration are absent from it.

## Documentation checks

`npm run docs:check` verifies the exact 13 README sections and seven SUBMISSION
sections, three approximately 80-word decisions, five-sentence build summary,
150-word C/D limits, seven milestone rows, five next steps and eleven weighted
rubric rows. It also checks actual commit references, sequential prompt numbers
and required local documentation links. SUBMISSION uses a maximum 900-word
two-page-equivalent budget; no PDF pagination is claimed.

CI originally included the same documentation check and fetched full history.
On 2026-10-22, the user requested tests and coverage only; that CI step and its
full-history checkout requirement were removed. The checker remains available
as an optional manual command. It does not declare hosted services live, prove
semantic correctness or silently modify documentation.

The README records real commands, environment/configuration, rule/test mapping,
reviewer clock, known gaps, AI disclosure and source references. SUBMISSION
separates implemented/local behavior from incomplete public release gates.
`PROMPTS.md` records this request as entry 19 without inventing missing history.
The available greeting and browser-test approval are explicitly accounted for.
Both app READMEs now describe the real clinic commands instead of starter demos.

## Clean checkout evidence

A fresh local Git clone of **committed `eff65d8`**, without ignored workspace
files, was created under `/tmp`. It lacks both app `package-lock.json` files and
`docker-compose.verify.yml`. `npm ci --prefix frontend --ignore-scripts` exits 1
with the missing-lockfile error. This is a real failed clean-clone gate.

Both lockfiles are deliberately ignored by the existing `.gitignore` user
preference. Making them trackable is pending an answer. The verification Compose
file already exists locally but must enter the user's eventual commit. No clean
clone of a published revision is called successful using copied ignored files.

A separate candidate checkout copies current reviewable source and the two
existing lockfiles into an otherwise fresh clone. Both `npm ci` installs pass
without reused workspace `node_modules` or private `.env` files. With bundled
Node **24.19.0**, `npm run coverage` exits 0: **220 backend tests / 10 suites,
27 browser tests (44.9s)**, strict builds/lint and readiness 200 → 503 → 200.
Existing Chrome is selected by the documented executable override. Combined
coverage matches the committed snapshot exactly, including all metric counts.
This verifies the proposed package while leaving the original ignore choice and
Git index unchanged; it does not repair or establish a published-clone pass.

Fresh `npm run dev:seed` also exits 0 on a dedicated disposable Compose project
at ports 18080/13000, starting with no `.env`. The command initializes its
sanitized local env, migrates, waits for all three services and seeds fictional
data. Production HTML/JS, nginx `/api` readiness, Swagger/OpenAPI, two seeded
doctors, four reference-day bookings, the reviewer header and explicit allowed/
denied CORS checks pass. Normal clinic UI/readiness at 8080/3000 stay 200 and
its database is separate. Only the disposable project and its new volume are
removed after verification. This is clean candidate evidence, not a published
commit/hosted/clean-machine operating-system installation claim.

## Coverage and repository hygiene

`coverage.txt` is already committed in `eff65d8` and reports the verified M5 run:
220 backend cases, 27 browser cases; backend lines 97.47%, statements 96.93%,
branches 84.83%, functions 98.50%; business lines 97.91%. Runtime scope is
`backend/src/**/*.ts`, excluding generated Prisma; tests, Prisma seed/config and
orchestration scripts are outside that denominator. Their behavior is checked
through integration/operational runs. No frontend coverage percentage is claimed. The candidate run revalidates all
these exact numerator/denominator counts; `coverage.txt` records that verification.

The targeted audit at `eff65d8` examined 177 tracked paths and 344 reachable Git
blobs. No generated/dependency/runtime-env/credential-file paths were tracked.
No matches were found for private-key blocks, common GitHub/AWS/live-service
token patterns or non-local literal PostgreSQL credentials. Fictional local/test
connection strings and sanitized examples remain intentional. This bounded audit
does not prove the absence of every possible secret or inspect private ignored
environment values. No history was rewritten and no sensitive match was printed.

## Link verification

All 49 relative/absolute local Markdown targets checked across the project exist.
Of 20 nonlocal reference links, 18 return HTTP 200, the Dribbble reference returns
202, and the repository returns 404 anonymously. A 202 response does not verify
rendered design content. Historical design evidence retains its original scope.
Local UI/API/health/docs and the fresh candidate production bundle respond 200;
native Vite on port 5173
requires starting that development server and is not described as currently live.

## External gates and release status

- Render authentication still reports `unauthorized`; no hosted UI/API URLs have
  been supplied, so all hosted checks remain pending.
- Anonymous GitHub repository and workflow-run requests return 404; authenticated
  Git can read the remote SHA. Public repository visibility and a successful CI
  run therefore remain **unverified**, rather than assumed private or successful.
- No actual application cold-start duration or hosting/database expiry is invented.
- The [reviewer checklist](reviewer-checklist.md) maps every required edge-case
  group to local test evidence and explicitly pending hosted checks.

Finish by resolving lockfile packaging, committing the missing reviewable files,
deploying and verifying M5, running the checklist against actual hosted services,
checking public repository/CI access, cloning the final commit and repeating its
setup/coverage gate. Only then create the final `v1.0` tag under the user's Git
workflow. M6 remains incomplete while those requirements are unverified.

Graphify was consulted first. Its existing report predates M5/M6 and has known
self-loop/parser limitations; it was used for navigation, not completion evidence.
The stale marker remains and no refresh is claimed.
