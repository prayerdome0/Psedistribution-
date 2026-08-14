import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith('--')) continue;
  argumentsByName.set(argument.slice(2), process.argv[index + 1]?.startsWith('--') ? true : process.argv[++index]);
}

const publicRoot = path.resolve(repositoryRoot, String(argumentsByName.get('root') ?? '.vercel-public'));
const axePath = argumentsByName.has('axe-path') ? path.resolve(String(argumentsByName.get('axe-path'))) : null;
const chromePath = String(
  argumentsByName.get('chrome')
  ?? process.env.PILOT_CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
);
const releaseManifest = JSON.parse(await readFile(path.join(repositoryRoot, 'public-release.json'), 'utf8'));
const releaseHtmlPages = releaseManifest.filter((entry) => entry.endsWith('.html'));

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

function createStaticServer(root) {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relative = requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      const target = path.resolve(root, relative);
      if (!target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const targetStat = await stat(target);
      if (!targetStat.isFile()) throw new Error('not a file');
      const contentType = mimeTypes.get(path.extname(target).toLowerCase()) ?? 'application/octet-stream';
      const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : targetStat.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= targetStat.size) {
          response.writeHead(416, { 'Content-Range': `bytes */${targetStat.size}` }).end();
          return;
        }
        response.writeHead(206, {
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${targetStat.size}`,
          'Content-Type': contentType,
        });
        createReadStream(target, { start, end }).pipe(response);
        return;
      }
      response.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': targetStat.size,
        'Content-Type': contentType,
      });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForJson(url, timeoutMilliseconds = 15000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(webSocketUrl);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(client, expression, timeoutMilliseconds = 10000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function navigate(client, url, width, height) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send('Page.navigate', { url });
  await waitFor(client, 'document.readyState === "complete"');
  await new Promise((resolve) => setTimeout(resolve, 700));
}

const heroAuditExpression = `(() => {
  const hero = document.querySelector('[data-cinematic-hero]');
  if (!hero) return { error: 'hero missing' };
  const select = (selector) => [...document.querySelectorAll(selector)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { selector, text: element.textContent.trim().slice(0, 80), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
  const promise = select('.hero-promise > .eyebrow, .hero-promise > h1, .hero-promise > .lede, .hero-promise > .microcopy');
  const action = select('.hero-action__copy > .eyebrow, .hero-action__copy > strong, .hero-action > .button, .hero-action > span');
  const intersections = [];
  for (const first of promise) for (const second of action) {
    const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
    const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
    if (width > 0.5 && height > 0.5) intersections.push({ first: first.text, second: second.text, width, height });
  }
  const video = hero.querySelector('[data-hero-video]');
  return {
    classes: [...hero.classList],
    intersections,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    preload: video?.preload,
    paused: video?.paused,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
})()`;

function addCheck(checks, name, passed, details) {
  checks.push({ name, status: passed ? 'PASS' : 'FAIL', details });
}

async function runAxe(client, axeSource, page) {
  await evaluate(client, `${axeSource}\ntrue`);
  return evaluate(client, `(async () => {
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations']
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target)
    }));
  })()`);
}

async function main() {
  const rootStat = await stat(publicRoot);
  if (!rootStat.isDirectory()) throw new Error(`Public root is not a directory: ${publicRoot}`);

  const checks = [];
  const server = createStaticServer(publicRoot);
  const webPort = await listen(server);
  const baseUrl = `http://127.0.0.1:${webPort}`;
  const chromePort = await freePort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'pilot-browser-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${profileDirectory}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    'about:blank',
  ], { stdio: 'ignore' });
  let client;

  try {
    await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
    const targetResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetResponse.json();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);

    const networkRequests = [];
    client.on('Network.requestWillBeSent', (event) => networkRequests.push(event.request.url));

    for (const page of releaseHtmlPages) {
      const response = await fetch(`${baseUrl}/${page}`);
      addCheck(checks, `route:${page}`, response.status === 200, { status: response.status });
    }
    const missingResponse = await fetch(`${baseUrl}/legacy-route-that-must-not-exist.html`);
    addCheck(checks, 'route:unknown-is-404', missingResponse.status === 404, { status: missingResponse.status });

    await navigate(client, `${baseUrl}/index.html`, 1280, 720);
    await waitFor(client, "document.querySelector('[data-cinematic-hero]') !== null");
    const desktop = await evaluate(client, heroAuditExpression);
    addCheck(checks, 'hero:desktop-1280x720-no-overlap', desktop.intersections.length === 0, desktop);
    addCheck(checks, 'hero:desktop-no-overflow', desktop.overflow <= 1, desktop);

    await navigate(client, `${baseUrl}/index.html`, 390, 844);
    const mobile = await evaluate(client, heroAuditExpression);
    addCheck(
      checks,
      'hero:mobile-poster-layout',
      mobile.classes.includes('cinematic-hero--poster-only')
        && !mobile.classes.includes('cinematic-hero--interactive')
        && mobile.intersections.length === 0
        && mobile.overflow <= 1,
      mobile,
    );

    await navigate(client, `${baseUrl}/index.html`, 1280, 800);
    await waitFor(client, "document.querySelector('[data-cinematic-hero]').classList.contains('cinematic-hero--interactive')", 15000);
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const resized = await evaluate(client, heroAuditExpression);
    addCheck(
      checks,
      'hero:desktop-to-mobile-resynchronizes',
      resized.classes.includes('cinematic-hero--poster-only')
        && !resized.classes.includes('cinematic-hero--interactive')
        && resized.preload === 'none'
        && resized.paused === true
        && resized.intersections.length === 0
        && resized.overflow <= 1,
      resized,
    );

    await navigate(client, `${baseUrl}/rfq.html`, 1280, 800);
    const invalidResult = await evaluate(client, `(() => {
      document.querySelector('#rfq-form').requestSubmit();
      return {
        summaryVisible: !document.querySelector('#form-errors').hidden,
        invalidCount: document.querySelectorAll('[aria-invalid="true"]').length,
      };
    })()`);
    addCheck(checks, 'rfq:required-validation', invalidResult.summaryVisible && invalidResult.invalidCount === 5, invalidResult);
    const requestCountBeforeDraft = networkRequests.length;
    const draftResult = await evaluate(client, `(() => {
      const set = (id, value) => {
        const field = document.getElementById(id);
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('category', 'Home goods');
      set('quantity', '2 pallets');
      set('destination', 'Los Angeles, CA');
      set('timing', 'This month');
      document.getElementById('safe-input').checked = true;
      document.getElementById('safe-input').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('#rfq-form').requestSubmit();
      return {
        outputVisible: !document.querySelector('#draft-output').hidden,
        output: document.querySelector('#draft-output').textContent,
        status: document.querySelector('#draft-state-title').textContent,
      };
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const draftRequests = networkRequests.slice(requestCountBeforeDraft).filter((url) => url.startsWith('http'));
    addCheck(
      checks,
      'rfq:local-draft-only',
      draftResult.outputVisible
        && draftResult.output.includes('STATUS: NOT SUBMITTED / NOT AN ORDER')
        && draftResult.status.includes('not submitted')
        && draftRequests.length === 0,
      { ...draftResult, networkRequests: draftRequests },
    );

    if (axePath) {
      const axeSource = await readFile(axePath, 'utf8');
      for (const page of ['index.html', 'products.html', 'rfq.html']) {
        await navigate(client, `${baseUrl}/${page}`, page === 'index.html' ? 1280 : 1100, 800);
        const violations = await runAxe(client, axeSource, page);
        addCheck(checks, `axe:${page}`, violations.length === 0, { violations });
      }
    } else {
      checks.push({ name: 'axe:public-pages', status: 'NOT_RUN', details: 'Pass --axe-path to enable WCAG checks' });
    }

    const failures = checks.filter((check) => check.status === 'FAIL');
    process.stdout.write(`${JSON.stringify({ root: publicRoot, checks }, null, 2)}\n`);
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    client?.close();
    chrome.kill('SIGTERM');
    await new Promise((resolve) => server.close(resolve));
    await rm(profileDirectory, { recursive: true, force: true });
  }
}

await main();
