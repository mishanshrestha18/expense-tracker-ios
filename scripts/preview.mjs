#!/usr/bin/env node
/**
 * The web preview, with the two things it always needs:
 *
 * 1. Cross-origin isolation headers. `expo-sqlite` runs SQLite in a worker over
 *    SharedArrayBuffer, which the browser only hands out to an isolated page,
 *    and the Expo dev server does not send those headers. This proxies it.
 * 2. A fresh origin each run. The web build keeps its database in OPFS, which
 *    is locked to one tab per origin: a tab left open from an earlier run makes
 *    the next one fail with `NoModificationAllowedError`. Every run therefore
 *    prints a different 127.0.0.x address, which the browser treats as a
 *    different origin with its own empty database.
 *
 * Usage: `npm run preview` (Ctrl-C stops both). Add `--attach` when a dev
 * server is already running on the same port.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const DEV_PORT = Number(process.env.EXPO_PORT ?? 8081);
const PROXY_PORT = Number(process.env.PREVIEW_PORT ?? 8090);
const attach = process.argv.includes('--attach');

/** 127.0.0.2 … 127.0.0.250: a different origin, so a different OPFS database. */
const host = `127.0.0.${2 + Math.floor(Math.random() * 249)}`;

const server = spawn('npx', ['expo', 'start', '--web', '--port', String(DEV_PORT)], {
  stdio: attach ? 'ignore' : 'inherit',
  shell: process.platform === 'win32',
});

const proxy = http.createServer((request, response) => {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: DEV_PORT,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, host: `localhost:${DEV_PORT}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, {
        ...upstreamResponse.headers,
        'cross-origin-embedder-policy': 'credentialless',
        'cross-origin-opener-policy': 'same-origin',
      });
      upstreamResponse.pipe(response);
    },
  );

  upstream.on('error', (error) => {
    response.writeHead(502, { 'content-type': 'text/plain' });
    response.end(`The dev server is not answering on port ${DEV_PORT}: ${error.message}`);
  });
  request.pipe(upstream);
});

proxy.listen(PROXY_PORT, () => {
  console.log(`\n  Preview: http://${host}:${PROXY_PORT}\n`);
  console.log('  A new address every run, so an old tab cannot hold the database.');
  console.log('  Read it with page text before reaching for a screenshot.\n');
});

function stop() {
  proxy.close();
  if (!attach) server.kill();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => {
  if (!attach) {
    proxy.close();
    process.exit(code ?? 0);
  }
});
