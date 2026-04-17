# Bracco Analytics MCP

A read-only MCP (Model Context Protocol) client that lets you ask Claude
questions about how the @PlayBracco and @BraccoBaseball social bots are
performing.

- **Read-only.** You cannot change the bot, alter follow/DM behavior, or write
  to the database. Every query hits a `SELECT`-only HTTP API.
- **All accounts.** Works for `playbracco`, `baseball`, and any future
  accounts added to the system.
- **Natural language.** Ask Claude:
  - "How is PlayBracco doing today?"
  - "Which competitor gives us the best follow-back rate?"
  - "Show me the 5 worst-performing BraccoBaseball posts this week."
  - "Compare engagement between the two accounts."
  - "What times of day does BraccoBaseball perform best?"

## What it can tell you

| Tool                       | Answers questions like                                     |
| -------------------------- | ---------------------------------------------------------- |
| `list_accounts`            | Which accounts exist?                                      |
| `compare_accounts`         | How do all accounts stack up against each other?           |
| `get_summary`              | What's today's activity for account X?                     |
| `get_follow_funnel`        | Sent → follow-back → DM → reply rates                      |
| `get_top_posts`            | What are our best-performing posts?                        |
| `get_bottom_posts`         | What's not working?                                        |
| `get_recent_posts`         | What did the bot just post?                                |
| `get_daily_stats`          | Day-by-day follows/DMs/unfollows                           |
| `get_daily_post_volume`    | Post volume and engagement trends                          |
| `get_source_breakdown`     | Which source accounts drive the best content/follow-backs? |
| `get_best_posting_hours`   | When does engagement peak?                                 |
| `get_dm_performance`       | Recent DMs sent and their reply status                     |

---

## Setup (one-time)

### Prerequisites

- **Node.js 18+** — check with `node --version` ([install](https://nodejs.org))
- **Claude Code** — ([install](https://docs.claude.com/claude-code))

### 1. Clone and install

```bash
git clone https://github.com/jacobq61/bracco-analytics-mcp.git ~/bracco-analytics-mcp
cd ~/bracco-analytics-mcp
npm install
pwd
```

Copy the path `pwd` prints — you'll paste it in step 2.

### 2. Add the server to Claude Code

Ask Jacob for the **API URL** and **API Key**, then run:

```bash
claude mcp add bracco-analytics \
  --env BRACCO_API_URL=<URL-FROM-JACOB> \
  --env BRACCO_API_KEY=<KEY-FROM-JACOB> \
  -- node <PATH-FROM-STEP-1>/index.mjs
```

### 3. Verify

Open Claude Code and ask:

> "List the MCP servers you have access to."

You should see `bracco-analytics` in the list. Then try:

> "Use bracco-analytics to compare both accounts."

---

## Troubleshooting

**"Missing BRACCO_API_URL or BRACCO_API_KEY"**
→ The `--env` flags in the `claude mcp add` command are missing or wrong. Re-run the command.

**"API 401: Unauthorized"**
→ Wrong `BRACCO_API_KEY`. Ask Jacob to resend.

**"Cannot find module"**
→ Re-run `npm install` from inside the `~/bracco-analytics-mcp` folder.

**Server doesn't appear in Claude**
→ Run `claude mcp list` to confirm it's registered. Make sure the path to `index.mjs` is absolute and correct.

---

## What you CANNOT do with this

- ❌ Change any bot behavior
- ❌ Send follows, DMs, or posts
- ❌ Modify the database
- ❌ Access bot credentials or user tokens
- ❌ Stop or restart the bot

The only thing exposed is a set of read-only SELECT queries over the analytics
database. The API key only unlocks `GET` endpoints — nothing else.
