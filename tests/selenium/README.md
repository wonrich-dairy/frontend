# Selenium end-to-end suite (SCRUM-129)

Browser tests that drive Chrome through the real client and services. They check what the
per-service tests cannot: that a screen works for the role it is meant for, is refused to the
roles it is not, and shows what the backend recorded.

| Test class | What it covers | Stories |
|---|---|---|
| `LabHistoryTests` | Lab History as a quality analyst: results, summary, filters, CSV export | SCRUM-25 |
| `QcoScreensTests` | QCO dashboard (also at 360 px), batch search, timeline, backward trace, batch filters and export | SCRUM-136, 137, 139 |
| `RoleAccessTests` | Negative role checks, in the browser and at the API (403): a lab user cannot open the QCO dashboard; an Intake Officer cannot read lab history | SCRUM-129, 25, 135, 136 |
| `TraceabilityServiceTests` | Traceability `/health`, and every endpoint listed in Swagger UI | SCRUM-119, 120, 125, 133, 135 |
| `DeterminationToTraceabilityTests` | Scripted scenario: an analyst passes a batch in the client, Quality Lab publishes BatchCleared, Traceability shows it Cleared. Seeds the batch in the Traceability database, so it runs on the local stack only | SCRUM-24, 131, 133 |
| `FailedBatchTraceScenarioTests` | Scripted scenario from the lab onwards: a deliberately low fat reading, the analyst fails the batch, the QCO finds it under Recent failures and the backward trace names the Quality lab and the fat reading. Local stack only, like the scenario above | SCRUM-129, 134, 137 |

The scripted scenario does not yet start at the chilling centre: a processing run stays *Awaiting lab result* until the intake lab panel (CF-1) exists, so the two scenarios seed the batch in Traceability (`TraceabilitySeed`) in the state the processing consumer would leave it, including its count on the dashboard.

Each test is tagged with its story, so one story can be run on its own: `--filter "Story=SCRUM-137"`.

## Configuration

Everything environment-specific is read from environment variables, so no credential or
staging URL is kept in the source.

| Variable | Needed | Default |
|---|---|---|
| `SELENIUM_PASSWORD` | yes | none: the password of the seeded accounts (`admin`, `analyst`, `officer`, ...) |
| `FRONTEND_URL` | | `http://localhost:5173` |
| `AUTH_API_URL` | | `http://localhost:5238` |
| `QUALITY_LAB_API_URL` | | `http://localhost:5069` |
| `TRACEABILITY_API_URL` | | `http://localhost:5240` |
| `QCO_FAILED_BATCH` | | `262-FLM-A` (a failed batch in the sample data) |
| `TRACEABILITY_DB` | for the two scripted scenarios | none: they are skipped |
| `SELENIUM_ARTIFACTS` | | none: folder for a screenshot and browser console log after every test |
| `SELENIUM_SCREENSHOTS` | | none: folder for the named evidence screenshots |
| `SELENIUM_HEADED` | | Chrome runs headless; `1` shows the window |
| `VERCEL_BYPASS_SECRET` | while Vercel Deployment Protection is on | none: the frontend is opened directly |

## Running locally

Start the Docker stack (Auth, MySQL, Kafka), run Quality Lab on :5069 and Traceability on :5240,
and serve the client on :5173 pointing at them:

```sh
VITE_TRACEABILITY_API_URL=http://localhost:5240 VITE_QUALITY_LAB_API_URL=http://localhost:5069 npx vite --port 5173
```

Then, in `tests/selenium`:

```sh
export SELENIUM_PASSWORD='<seed password>'
export SELENIUM_ARTIFACTS=./artifacts
dotnet test --logger "console;verbosity=normal"
```

Selenium Manager downloads a ChromeDriver that matches the installed Chrome on the first run.

## In CI

`.github/workflows/selenium.yml` runs the suite against staging after each successful deployment,
on weekday mornings, and by hand (with an optional test filter). The URLs and the password are
secrets of the `staging` GitHub environment; the workflow header lists them.

The Vercel project has Deployment Protection on, so without help the browser gets Vercel's sign-in
page instead of the app. In the Vercel project, Settings -> Deployment Protection -> Protection Bypass
for Automation gives a secret; save it as `VERCEL_BYPASS_SECRET` in the `staging` environment. The
first page load of each sign-in passes it to Vercel, which sets a cookie for the rest of the session.

- Failures are annotated in the run and summarised on its page (GitHubActionsTestLogger).
- The `selenium-results` artifact holds the TRX results, a screenshot and the browser console log
  of every test (`captures/`), and the evidence screenshots (`evidence/`).
- Tests run one at a time: they share a signed-in browser per class, and the capture after each
  test reads that browser.

## Writing a test

- One class per screen or journey, with `IClassFixture<Browser>` and `[CaptureAfterTest]`.
- Tag it with `[Trait("Story", "SCRUM-…")]`.
- Sign in with a seeded account (`_browser.SignIn("admin")`). Wait for what the user would see
  (`_browser.Wait.Until(...)`), never a fixed sleep, except to prove that something does not appear.
- Check a refused role at the API too: a hidden menu item is not access control.
- Any defect a test finds goes into Jira with its severity and priority, linked to the story,
  with the failing test named in the description.
