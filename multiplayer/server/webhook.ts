import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main';

export function setupWebhook(app: express.Express) {
  app.post('/webhook/github', express.raw({ type: 'application/json' }), async (req, res) => {
    // Verify signature
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature || !WEBHOOK_SECRET) {
      console.log('[Webhook] Missing signature or secret');
      return res.status(401).send('Unauthorized');
    }

    const body = req.body;
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.log('[Webhook] Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    // Parse the payload
    const payload = JSON.parse(body.toString());
    const event = req.headers['x-github-event'];

    console.log(`[Webhook] Received ${event} event`);

    // Only process push events to the deploy branch
    if (event !== 'push') {
      return res.status(200).send('Ignored: not a push event');
    }

    const branch = payload.ref?.replace('refs/heads/', '');
    if (branch !== DEPLOY_BRANCH) {
      console.log(`[Webhook] Ignored push to ${branch}, only deploying ${DEPLOY_BRANCH}`);
      return res.status(200).send(`Ignored: push to ${branch}`);
    }

    console.log(`[Webhook] Deploying from ${DEPLOY_BRANCH}...`);
    res.status(200).send('Deployment started');

    // Run deployment in background
    try {
      const appDir = process.cwd();

      // NVM loader for shell commands
      const nvmLoad = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && ';

      // Pull latest changes
      console.log('[Webhook] Pulling latest changes...');
      await execAsync('git fetch origin && git reset --hard origin/' + DEPLOY_BRANCH, { cwd: appDir });

      // Install dependencies
      console.log('[Webhook] Installing dependencies...');
      await execAsync(nvmLoad + 'npm install --production=false', { cwd: appDir, shell: '/bin/bash' });

      // Rebuild frontend
      console.log('[Webhook] Building frontend...');
      await execAsync(nvmLoad + 'npm run build', { cwd: appDir, shell: '/bin/bash' });

      // Restart PM2
      console.log('[Webhook] Restarting application...');
      await execAsync(nvmLoad + 'pm2 restart bigtwo', { shell: '/bin/bash' });

      console.log('[Webhook] Deployment complete!');
    } catch (error) {
      console.error('[Webhook] Deployment failed:', error);
    }
  });

  console.log('[Webhook] GitHub webhook endpoint registered at /webhook/github');
}
