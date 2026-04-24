#!/usr/bin/env node
/**
 * Bracco Analytics MCP server.
 *
 * Exposes read-only analytics about the @PlayBracco and @BraccoBaseball
 * social bots to Claude. The team installs this locally and configures
 * Claude Desktop (or Claude Code) to load it. All queries hit a read-only
 * HTTP API on the Railway service — NO ability to modify the bot.
 *
 * Environment variables required:
 *   BRACCO_API_URL  — base URL of the analytics API (https://…up.railway.app)
 *   BRACCO_API_KEY  — shared API key
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = process.env.BRACCO_API_URL?.replace(/\/+$/, '');
const API_KEY = process.env.BRACCO_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Missing BRACCO_API_URL or BRACCO_API_KEY env var');
  process.exit(1);
}

async function apiGet(path, params = {}) {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

function toContent(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({
  name:    'bracco-analytics',
  version: '1.0.0',
});

// ── Discovery ─────────────────────────────────────────────────────────────────
server.tool(
  'list_accounts',
  'List every bot account present in the database (e.g. "baseball", "playbracco"). Call this first if you are not sure which account to query.',
  {},
  async () => toContent(await apiGet('/accounts'))
);

server.tool(
  'compare_accounts',
  'Side-by-side comparison of all accounts — follow volume, follow-back rate, DMs sent, DM reply rate, post count, average engagement. Use this for "how is each account doing?" questions.',
  {},
  async () => toContent(await apiGet('/compare-accounts'))
);

// ── Per-account summaries ────────────────────────────────────────────────────
server.tool(
  'get_summary',
  'High-level stats for one account: today/7d/30d post counts, engagement distribution, follow totals + follow-back rate, DM totals + reply rate. Good starting point for any account-specific question.',
  { account: z.string().describe('Account name, e.g. "baseball" or "playbracco"') },
  async ({ account }) => toContent(await apiGet('/summary', { account }))
);

server.tool(
  'get_follow_funnel',
  'Full funnel metrics for an account: follows sent → follow-backs → DMs sent → DM replies. Shows conversion rate at each step.',
  { account: z.string() },
  async ({ account }) => toContent(await apiGet('/follow-funnel', { account }))
);

// ── Content performance ──────────────────────────────────────────────────────
server.tool(
  'get_top_posts',
  'The highest-engagement posts for an account. Returns caption, engagement score, source account, date, and tweet ID.',
  {
    account: z.string(),
    limit:   z.number().int().min(1).max(100).optional().describe('Default 20'),
  },
  async ({ account, limit }) => toContent(await apiGet('/top-posts', { account, limit }))
);

server.tool(
  'get_bottom_posts',
  'The lowest-engagement posts — useful for understanding what is NOT working.',
  {
    account: z.string(),
    limit:   z.number().int().min(1).max(50).optional().describe('Default 10'),
  },
  async ({ account, limit }) => toContent(await apiGet('/bottom-posts', { account, limit }))
);

server.tool(
  'get_recent_posts',
  'Most recent posts with their engagement scores (if available yet). Use to see what the bot is posting right now.',
  {
    account: z.string(),
    limit:   z.number().int().min(1).max(200).optional().describe('Default 30'),
  },
  async ({ account, limit }) => toContent(await apiGet('/recent-posts', { account, limit }))
);

// ── Time-series ──────────────────────────────────────────────────────────────
server.tool(
  'get_daily_stats',
  'Daily aggregated stats (follows sent, follow-backs, DMs sent, DM replies, unfollows) for an account, day-by-day.',
  {
    account: z.string(),
    days:    z.number().int().min(1).max(365).optional().describe('How many days back. Default 30'),
  },
  async ({ account, days }) => toContent(await apiGet('/daily-stats', { account, days }))
);

server.tool(
  'get_daily_post_volume',
  'Post volume and average engagement per day for an account. Use to spot trends — are we posting more? Is engagement climbing?',
  {
    account: z.string(),
    days:    z.number().int().min(1).max(365).optional().describe('Default 30'),
  },
  async ({ account, days }) => toContent(await apiGet('/daily-post-volume', { account, days }))
);

// ── Attribution ──────────────────────────────────────────────────────────────
server.tool(
  'get_source_breakdown',
  'Which source accounts drive the best content AND which follow sources drive the most follow-backs. Two breakdowns: posts-by-source (avg engagement) and follows-by-source (follow-back %).',
  { account: z.string() },
  async ({ account }) => toContent(await apiGet('/source-breakdown', { account }))
);

server.tool(
  'get_best_posting_hours',
  'What times of day (UTC) the account gets the most engagement. Useful for scheduling insight.',
  { account: z.string() },
  async ({ account }) => toContent(await apiGet('/best-posting-hours', { account }))
);

// ── DMs ──────────────────────────────────────────────────────────────────────
server.tool(
  'get_dm_performance',
  'DM send/reply stats for an account, plus the most recent DMs sent with their reply status.',
  {
    account: z.string(),
    limit:   z.number().int().min(1).max(500).optional().describe('Recent DM count to return, default 100'),
  },
  async ({ account, limit }) => toContent(await apiGet('/dm-performance', { account, limit }))
);

server.tool(
  'get_warm_leads',
  'Users who replied to our DM with "interested" or "question" sentiment — the highest-value leads the team should personally follow up with. Includes their handle, reply text, and the original DM they received.',
  {
    account: z.string(),
    limit:   z.number().int().min(1).max(500).optional().describe('Default 100'),
  },
  async ({ account, limit }) => toContent(await apiGet('/warm-leads', { account, limit }))
);

// ── Odds-reply pipeline (PlayBracco replies on Bracco sport posts) ──────────
server.tool(
  'get_odds_replies',
  'Recent decisions made by the PlayBracco odds-reply pipeline. Each row shows: parent tweet from BraccoBaseball/NFL, extracted player+event, looked-up odds, status (replied/scheduled/skipped/would_have_replied), and either the posted reply or the planned reply (if feature flag is off / dry-run).',
  { limit: z.number().int().min(1).max(500).optional().describe('Default 50') },
  async ({ limit }) => toContent(await apiGet('/odds-replies', { limit }))
);

server.tool(
  'get_odds_reply_summary',
  'Last 7 days of odds-reply pipeline outcomes — counts by status and by skip reason. Use this to see whether the system is finding matches, where it\'s skipping, and how many replies have actually fired.',
  {},
  async () => toContent(await apiGet('/odds-reply-summary'))
);

// ── bet105 slip-comparison pipeline ─────────────────────────────────────────
server.tool(
  'get_slip_comparisons',
  'Recent betslip-comparison decisions for bet105. Each row shows: original slip tweet, parsed slip data (source book, stake, payout), bet105 reprice (payout, dollar difference, percent more), and the planned or posted reply.',
  { limit: z.number().int().min(1).max(500).optional().describe('Default 50') },
  async ({ limit }) => toContent(await apiGet('/slip-comparisons', { limit }))
);

server.tool(
  'get_slip_summary',
  'Last 7 days of bet105 slip-comparison outcomes — counts by status and skip reason. Tells you whether the vision parser is finding usable slips and how often we have a real comparison opportunity.',
  {},
  async () => toContent(await apiGet('/slip-summary'))
);

// ── bet105 winners-welcome (limit/ban complaint replies) ───────────────────
server.tool(
  'get_winners_welcome',
  'Recent bet105 "Winners Welcome" replies — users complaining about being limited / closed / banned by other sportsbooks, and the bet105 callout reply that went out (or would have).',
  { limit: z.number().int().min(1).max(500).optional().describe('Default 50') },
  async ({ limit }) => toContent(await apiGet('/winners-welcome', { limit }))
);

server.tool(
  'get_winners_welcome_summary',
  'Last 7 days of Winners Welcome outcomes — counts by status. Shows whether the system is finding limit complaints and how often we\'re replying.',
  {},
  async () => toContent(await apiGet('/winners-welcome-summary'))
);

// ── Daily recap ─────────────────────────────────────────────────────────────
server.tool(
  'get_recap_history',
  'Recent daily recap posts (the 11pm ET "biggest wins of the day" thread from PlayBracco and bet105). Shows date, status, winner count, and the actual text that was posted.',
  { limit: z.number().int().min(1).max(60).optional().describe('Default 14 days') },
  async ({ limit }) => toContent(await apiGet('/recap-history', { limit }))
);

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Bracco Analytics MCP server running');
