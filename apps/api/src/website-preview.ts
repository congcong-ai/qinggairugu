import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createWebsiteApp } from './website';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

serve(
  { fetch: createWebsiteApp().fetch, hostname: '127.0.0.1', port: 3000 },
  () => {
    console.log('倾盖如故官网：http://localhost:3000');
  },
);
