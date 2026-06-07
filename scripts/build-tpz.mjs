/**
 * CyberDeck .tpz2 Builder
 *
 * Takes Puppeteer screenshots of all 7 pages of the React UI preview,
 * packages them as Touch Portal page bundles (.tpz2) and a plugin package (.tpp).
 *
 * Usage:
 *   node build-tpz.mjs                                  # full build (port 3000)
 *   BASE_URL=http://localhost:3002 node build-tpz.mjs   # different port
 *   node build-tpz.mjs --screenshots-only               # save PNGs only, no packaging
 */

import puppeteer from 'puppeteer';
import archiver  from 'archiver';
import fs        from 'fs';
import path      from 'path';
import { fileURLToPath } from 'url';
import { buildPageBundle } from './lib/page-builder.mjs';
import { buildEntryTp    } from './lib/entry-tp.mjs';

const __dirname       = path.dirname(fileURLToPath(import.meta.url));
const distDir         = path.resolve(__dirname, '..', 'dist');
const screenshotsDir  = path.join(distDir, 'screenshots');

const BASE_URL         = process.env.BASE_URL ?? 'http://localhost:3000';
const SCREENSHOTS_ONLY = process.argv.includes('--screenshots-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = [
  { id: 'dashboard',     title: 'CyberDeck Dashboard',       navLabel: 'DASH',   notifOverlay: false },
  { id: 'media',         title: 'CyberDeck Media Center',    navLabel: 'MEDIA',  notifOverlay: false },
  { id: 'system',        title: 'CyberDeck System Control',  navLabel: 'SYSTEM', notifOverlay: false },
  { id: 'gaming',        title: 'CyberDeck Gaming Hub',      navLabel: 'GAMING', notifOverlay: false },
  { id: 'smarthome',     title: 'CyberDeck Smart Home',      navLabel: 'HOME',   notifOverlay: false },
  { id: 'overview',      title: 'CyberDeck System Overview', navLabel: 'STATS',  notifOverlay: false },
  { id: 'notifications', title: 'CyberDeck Notifications',   navLabel: 'DASH',   notifOverlay: true  },
];

// Minimal valid 24×24 transparent PNG placeholder for plugin icon
const PLACEHOLDER_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAB3RJTUUH6AUCDBQBM/bMlAAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAOSURBVEjHY2AYBUMZAAIEAAFzAAHOuLFiAAAAAElFTkSuQmCC';

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   CyberDeck .tpz2 Builder            ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Mode     : ${SCREENSHOTS_ONLY ? 'screenshots only' : 'full package build'}\n`);

  // 1. Verify dev server
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(`✅ Dev server is running at ${BASE_URL}\n`);
  } catch {
    console.error(`❌ Cannot reach dev server at ${BASE_URL}`);
    console.error(`   Run first: cd D:\\Repo\\CyberDeck\\ui && npm run dev\n`);
    process.exit(1);
  }

  // 2. Prepare dirs
  fs.mkdirSync(distDir, { recursive: true });
  if (SCREENSHOTS_ONLY) fs.mkdirSync(screenshotsDir, { recursive: true });

  // 3. Launch Puppeteer
  console.log('📸 Launching headless browser…\n');
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const tab = await browser.newPage();
  tab.on('console', () => {});
  tab.on('pageerror', () => {});

  await tab.goto(BASE_URL, { waitUntil: 'load', timeout: 30_000 });
  await tab.waitForSelector('.app-canvas', { timeout: 10_000 });
  await tab.evaluate(() => document.fonts.ready);
  await sleep(1200);

  // 4. Screenshot each page
  const screenshots = {};

  for (const pg of PAGES) {
    process.stdout.write(`   📷 ${pg.title}…`);

    if (pg.notifOverlay) {
      await clickSidebarNav(tab, 'DASH');
      await sleep(600);
      await tab.click('.cd-header__notif-btn');
    } else {
      await clickSidebarNav(tab, pg.navLabel);
    }

    await sleep(700);

    const canvasHandle = await tab.$('.app-canvas');
    const buffer = canvasHandle
      ? await canvasHandle.screenshot({ type: 'png' })
      : await tab.screenshot({ type: 'png', fullPage: false });

    screenshots[pg.id] = buffer;
    console.log(' ✓');

    if (SCREENSHOTS_ONLY) {
      fs.writeFileSync(path.join(screenshotsDir, `${pg.id}.png`), buffer);
    }

    if (pg.notifOverlay) {
      await tab.keyboard.press('Escape');
      await sleep(300);
    }
  }

  await browser.close();
  console.log('\n✅ All screenshots captured');

  if (SCREENSHOTS_ONLY) {
    console.log(`\n🎉 Screenshots saved to dist/screenshots/\n`);
    return;
  }

  // 5. Build page bundles
  console.log('\n📦 Packaging .tpz2 files…\n');

  const bundles = {};
  for (const pg of PAGES) {
    bundles[pg.id] = buildPageBundle(pg.id, pg.title, screenshots[pg.id]);
  }

  // Individual page .tpz2 files
  for (const pg of PAGES) {
    const { dataJson, imgFilename, imgBuffer } = bundles[pg.id];
    const outName = `CyberDeck_${capitalize(pg.id)}.tpz2`;
    const outPath = path.join(distDir, outName);

    await createZip(outPath, [
      { content: '{"version":2}', name: 'version.json' },
      { content: dataJson,        name: 'data.json' },
      { content: imgBuffer,       name: `img/${imgFilename}` },
    ]);
    console.log(`   ✅ ${outName}`);
  }

  // Combined CyberDeck_Full.tpz2 — all 7 pages + all 7 images
  const allPageStrings = PAGES.map((pg) => {
    const parsed = JSON.parse(bundles[pg.id].dataJson);
    return parsed.pages[0]; // each is already a stringified page JSON
  });
  const fullDataJson = JSON.stringify({ pages: allPageStrings, flows: [], values: [] });

  const fullFiles = [
    { content: '{"version":2}', name: 'version.json' },
    { content: fullDataJson,    name: 'data.json' },
    ...PAGES.map((pg) => ({
      content: bundles[pg.id].imgBuffer,
      name:    `img/${bundles[pg.id].imgFilename}`,
    })),
  ];

  await createZip(path.join(distDir, 'CyberDeck_Full.tpz2'), fullFiles);
  console.log(`   ✅ CyberDeck_Full.tpz2`);

  // Plugin package (.tpp) — format unchanged
  const entryTp   = buildEntryTp();
  const iconBuf   = Buffer.from(PLACEHOLDER_ICON_B64, 'base64');
  await createZip(path.join(distDir, 'CyberDeck_Plugin.tpp'), [
    { content: JSON.stringify(entryTp, null, 2), name: 'entry.tp' },
    { content: iconBuf,                          name: 'assets/icons/cd_24.png' },
  ]);
  console.log(`   ✅ CyberDeck_Plugin.tpp`);

  // Save inspect copy for format verification
  const inspectDir = path.join(distDir, 'inspect');
  fs.mkdirSync(inspectDir, { recursive: true });
  fs.writeFileSync(path.join(inspectDir, 'dashboard_data.json'), bundles.dashboard.dataJson);
  fs.writeFileSync(path.join(inspectDir, 'entry.tp'), JSON.stringify(entryTp, null, 2));

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`🎉 Build complete!  Output: ${distDir}`);
  console.log(`${'─'.repeat(52)}\n`);
  console.log(`Import into Touch Portal:`);
  console.log(`  Pages : TP desktop → Pages → Import → CyberDeck_Full.tpz2`);
  console.log(`  Plugin: TP → Settings → Plug-ins → Import → CyberDeck_Plugin.tpp`);
  console.log(`          (TP will warn the .exe is missing — dismiss, pages still work)\n`);
  console.log(`Verify ZIP structure:`);
  console.log(`  Expand-Archive dist\\CyberDeck_Dashboard.tpz2 dist\\inspect\\new\\\n`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function clickSidebarNav(page, label) {
  await page.evaluate((navLabel) => {
    const walker = document.createTreeWalker(
      document.querySelector('.app-canvas') ?? document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim() === navLabel) {
        const btn = node.parentElement?.closest('button') ?? node.parentElement;
        if (btn) { btn.click(); return true; }
      }
    }
    return false;
  }, label);
}

function createZip(outputPath, files) {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const f of files) {
      archive.append(f.content, { name: f.name });
    }
    archive.finalize();
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n❌ Build failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
