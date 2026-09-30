# Pourhaven Refund Desk: an AI refund agent with human approval

Pourhaven is a demo store for coffee brewing gear. Customers ask for a refund from their order page
and add a photo. An AI refund agent in an Appwrite Function investigates each request. It refunds
small, clear cases on its own and hands everything else to the support team with a recommendation.
Staff decide in a live desk, and their decision starts the agent again to finish the job.

The model is GPT-6 Luna through OpenRouter.

## How it works

1. The web app uploads the photo to the `request_photos` bucket and calls the `intake` function.
   `intake` checks the order, locks the photo so the customer cannot delete it, and creates a
   `refund_requests` row that only the customer and the staff team can read.
2. The row's create event starts the `refund-agent` function. The model looks up the order, the
   customer's refund history, and the refund policy, and inspects the photo. Every tool call is a
   `run_steps` row. The desk shows each step live through Realtime, and the customer's request page
   shows the steps meant for the customer.
3. The model can ask for an automatic refund, but code decides. The refund goes through only when all
   of these are true: the item arrived damaged, stopped working, or is not what the customer ordered;
   it costs $50 or less; it was delivered in the last 30 days; the photo shows the problem; and the
   customer had no refund in the last 90 days. The refund is a row in the mock `payments` table with
   an ID derived from the request, so a second attempt cannot pay twice.
4. Everything else becomes an `approvals` row with the agent's recommendation, findings, and concerns.
   The execution ends. Nothing runs while the request waits for a person.
5. A staff member approves, declines, or asks the customer a question in the desk. That updates the
   `approvals` row, and the update event starts a new execution that rebuilds the case from TablesDB
   and carries out the decision. The agent only creates `approvals` rows and never updates them, so
   its own writes cannot start it again.
6. When an item must come back first, the agent queues a delayed execution of itself seven days out.
   That run refunds the item if staff marked it received, or reminds the customer and checks again.

Only members of the `staff` team can open the desk and read other customers' requests. Customers
see their own requests and only the steps marked for them.

## Layout

- `apps/web`: the React app, with the customer pages and the staff desk (Vite, TanStack Router and
  Query, Tailwind CSS, shadcn/ui).
- `functions/intake/src/main.js`: creates refund requests and customer answers for signed-in customers.
- `functions/refund-agent/src/main.js`: routes each execution (new request, staff decision, customer
  answer, return check) to its job in `src/jobs/`.
- `functions/refund-agent/src/lib/tools.js`: the tools the model can call, bound to one request.
- `functions/refund-agent/src/lib/guards.js`: the rules for automatic refunds.
- `functions/refund-agent/src/lib/model.js`: the OpenRouter client and the tool loop.
- `functions/refund-agent/src/lib/timeline.js`: claims each trigger once and writes the timeline.
- `functions/refund-agent/src/lib/refunds.js`: refunds, return codes, and delayed return checks.
- `functions/refund-agent/src/prompts.js`: the prompts and the structured output schemas.
- `functions/*/test`: unit tests with a scripted model and an in-memory TablesDB (`pnpm test`).
- `scripts/schema.ts`: the database, tables, bucket, team, and functions, in one place.
- `scripts/provision.ts`: creates everything in `schema.ts` and deploys both functions.
- `scripts/seed.ts`: creates the demo staff, customers, orders, policy, and resolved requests.
- `scripts/reset.ts`: deletes the requests you created, so every flow can run again.
- `scripts/photos/`: customer photos to try the flows with.

## Setup

You need Node.js 22 or later, pnpm, an Appwrite project, and an [OpenRouter](https://openrouter.ai)
API key.

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. In the Appwrite Console, open your project and create an API key with these scopes:
   `databases.write`, `tables.write`, `columns.read`, `columns.write`, `indexes.read`,
   `indexes.write`, `rows.read`, `rows.write`, `buckets.write`, `files.read`, `files.write`,
   `tokens.write`, `users.write`, `teams.read`, `teams.write`, `functions.read`, `functions.write`,
   `executions.read`, `executions.write`, `platforms.read`, and `platforms.write`. The scripts use
   it. The app never does.
3. Copy `.env.example` to `.env` and fill in the endpoint, project ID, API key, and OpenRouter API key.
4. Create the resources, deploy both functions, and add the demo data:

   ```bash
   pnpm provision
   pnpm seed
   ```

   `pnpm provision` stores the OpenRouter key as a secret variable of `refund-agent`. Run it again
   after you change a function or a setting. It keeps existing resources.
5. Copy `apps/web/.env.example` to `apps/web/.env`, fill in the endpoint and project ID, and start the
   app:

   ```bash
   pnpm dev
   ```

   Open http://localhost:5173. `pnpm provision` registered `localhost` as a web platform.

## Demo accounts

Every demo account uses the password `pourhaven-demo-2026`.

| Account | Role | Try |
| --- | --- | --- |
| `maya.okafor@example.com` | Staff (lead) | Approve, decline, or ask a question in the desk |
| `daniel.reyes@example.com` | Staff (support) | Mark a returned item as received |
| `priya.raman@example.com` | Customer | A cracked carafe ($34, refunded automatically) and a dented kettle ($129, goes to staff) |
| `aiko.tanaka@example.com` | Customer | A grinder with a cracked hopper ($249, the agent recommends a refund after a return) |
| `lucas.moreau@example.com` | Customer | A scale with a blank display (the agent suggests asking about batteries) |
| `tom.becker@example.com` | Customer | Two recent refunds, and a hand grinder delivered 48 days ago |
| `hannah.schulz@example.com` | Customer | A dripper photo that shows no damage |

The photos are in `scripts/photos/`. Run `pnpm reset` to delete the requests you created and start over.

## Settings

`pnpm provision` reads these optional values from `.env` and stores them on `refund-agent`:

| Variable | Default | What it sets |
| --- | --- | --- |
| `OPENROUTER_MODEL` | `openai/gpt-6-luna` | The model for the agent, the photo inspection, and decline messages |
| `AUTO_REFUND_LIMIT_CENTS` | `5000` | The highest price the agent refunds without a person |
| `REFUND_WINDOW_DAYS` | `30` | Days after delivery when automatic refunds are possible |
| `RETURN_CHECK_DELAY_MINUTES` | `10080` (7 days) | Time between a return code and each return check. Set `2` to watch the checks run. |

## Scripts

- `pnpm provision` and `pnpm seed`: see [Setup](#setup).
- `pnpm reset`: deletes the requests you created, with their timeline, answers, refunds, photos, and
  queued return checks. The demo accounts, orders, and resolved requests stay.
- `pnpm dev`: starts the web app.
- `pnpm test`: runs the function unit tests.
- `pnpm typecheck` and `pnpm lint`: check the TypeScript and the code style.

## License

MIT
