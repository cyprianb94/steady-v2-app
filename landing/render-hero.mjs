#!/usr/bin/env node
/**
 * Renders landing/hero-demo.html to an MP4 video by driving Chrome via
 * puppeteer-core and encoding frames with the ffmpeg binary bundled by
 * ffmpeg-static.
 *
 * Output: landing/assets/hero-demo.mp4
 *
 * Run:   node landing/render-hero.mjs
 */
import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_HTML = path.join(HERE, 'hero-demo.html');
const OUT_DIR = path.join(HERE, 'assets');
const OUT_MP4 = path.join(OUT_DIR, 'hero-demo.mp4');
const OUT_WEBM = path.join(OUT_DIR, 'hero-demo.webm');

// Viewport matches the iframe size used on the landing page
// (landing/index.html: .hero-demo-frame { width: 375px; height: 700px; })
const WIDTH = 750; // 2x device scale baked in for crisp mp4
const HEIGHT = 1400;
const FPS = 30;
const LOOP_SECONDS = 20; // one full animation cycle
const TOTAL_FRAMES = FPS * LOOP_SECONDS;

// Pick a Chrome binary we can rely on across mac setups
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Could not locate Chrome. Install Google Chrome or set CHROME_PATH.`,
  );
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function removeIfExists(p) {
  try { await unlink(p); } catch { /* ignore */ }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function renderFrames() {
  const chromePath = process.env.CHROME_PATH || findChrome();
  console.log(`Using Chrome: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
    },
  });

  try {
    const page = await browser.newPage();

    const url = pathToFileURL(SRC_HTML).href;
    console.log(`Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Give fonts a moment to finish rendering, then reset the CSS animation
    // so capture begins at frame 0.
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((r) => setTimeout(r, 500));

    // hero-demo.html defaults to transparent bg so it blends seamlessly when
    // embedded as an iframe on the landing page. For the standalone MP4 we
    // want a solid cream background, so opt into it before capturing.
    await page.evaluate(() => {
      document.documentElement.classList.add('solid-bg');
    });

    // Start every element with a fresh animation clock.
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        const name = getComputedStyle(el).animationName;
        if (!name || name === 'none') return;
        el.style.animation = 'none';
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        el.style.animation = '';
      });
    });

    // Start ffmpeg, piping PNG frames from puppeteer into it at FPS.
    await ensureDir(OUT_DIR);
    await removeIfExists(OUT_MP4);
    await removeIfExists(OUT_WEBM);

    const ffmpegArgs = [
      '-y',
      '-loglevel', 'error',
      '-f', 'image2pipe',
      '-framerate', String(FPS),
      '-i', '-',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'slow',
      '-crf', '18',
      '-movflags', '+faststart',
      OUT_MP4,
    ];

    console.log(`Capturing ${TOTAL_FRAMES} frames @ ${FPS}fps...`);
    const ff = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

    const writeFrame = (buf) => new Promise((resolve, reject) => {
      const ok = ff.stdin.write(buf, (err) => (err ? reject(err) : resolve()));
      if (!ok) ff.stdin.once('drain', resolve);
    });

    const startMs = Date.now();
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const targetMs = startMs + Math.round((i * 1000) / FPS);
      // Busy-wait via setTimeout to stay close to real time without freezing the loop.
      const wait = targetMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      const buf = await page.screenshot({ type: 'png', omitBackground: false });
      await writeFrame(buf);

      if (i % FPS === 0) {
        process.stdout.write(`  ${String(i + 1).padStart(4)}/${TOTAL_FRAMES}\r`);
      }
    }
    process.stdout.write(`  ${TOTAL_FRAMES}/${TOTAL_FRAMES}\n`);

    ff.stdin.end();
    await new Promise((resolve, reject) => {
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
      ff.on('error', reject);
    });

    console.log(`Wrote ${path.relative(process.cwd(), OUT_MP4)}`);
  } finally {
    await browser.close();
  }

  // Also produce a webm companion (smaller, native <video> fallback).
  console.log('Encoding webm companion...');
  await runFfmpeg([
    '-y', '-loglevel', 'error',
    '-i', OUT_MP4,
    '-c:v', 'libvpx-vp9',
    '-crf', '32',
    '-b:v', '0',
    '-pix_fmt', 'yuv420p',
    '-row-mt', '1',
    OUT_WEBM,
  ]);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_WEBM)}`);
}

renderFrames().catch((err) => {
  console.error(err);
  process.exit(1);
});
