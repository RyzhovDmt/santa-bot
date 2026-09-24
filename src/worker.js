import { webhookCallback } from 'grammy';
import { COMMANDS, createApp } from './bot.js';
import { runReminders } from './reminders.js';

// Telegram waits for the webhook response; a draw for 40 players takes a few seconds.
const WEBHOOK_TIMEOUT_MS = 25_000;

async function setupWebhook(api, url, env) {
  await api.setWebhook(url, {
    secret_token: env.WEBHOOK_SECRET,
    // One update at a time: handlers read and write whole games, parallel updates could overwrite each other.
    max_connections: 1,
    allowed_updates: ['message', 'callback_query'],
  });
  await api.setMyCommands(COMMANDS);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/webhook') {
      const { bot } = createApp(env);
      return webhookCallback(bot, 'cloudflare-mod', { secretToken: env.WEBHOOK_SECRET, timeoutMilliseconds: WEBHOOK_TIMEOUT_MS })(request);
    }

    // Registers the webhook from Cloudflare's side: api.telegram.org may be unreachable from the admin's machine.
    if (url.pathname === '/setup') {
      if (!env.WEBHOOK_SECRET || url.searchParams.get('secret') !== env.WEBHOOK_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
      const { bot } = createApp(env);
      await setupWebhook(bot.api, `${url.origin}/webhook`, env);
      const info = await bot.api.getWebhookInfo();
      return Response.json({ ok: true, webhook: info.url, pending_updates: info.pending_update_count });
    }

    return new Response('Secret Santa bot is running', { status: 200 });
  },

  async scheduled(event, env) {
    const app = createApp(env);

    // Self-healing: if PUBLIC_URL is configured, make sure Telegram knows the webhook.
    if (env.PUBLIC_URL) {
      const base = env.PUBLIC_URL.endsWith('/') ? env.PUBLIC_URL.slice(0, -1) : env.PUBLIC_URL;
      const expected = `${base}/webhook`;
      const info = await app.bot.api.getWebhookInfo();
      if (info.url !== expected) await setupWebhook(app.bot.api, expected, env);
    }

    await runReminders(app, env.DB, { hour: Number(env.REMINDER_HOUR ?? 11), now: new Date(event.scheduledTime) });
  },
};
