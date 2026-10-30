// Builds the static site into _site/ from content/ (edited by Ashley in Pages CMS) and src/.
// Photos are resized here, so Ashley can upload straight from her phone.
import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, '/');
const COLLECTIONS = ['candy-jade', 'aurum', 'aura'];
const STATUSES = ['ready', 'made', 'sold'];

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('sharp not installed: photos are copied without resizing'); }

const warnings = [];
const readJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); }
  catch (e) { if (existsSync(p)) warnings.push(`Could not read ${path.relative(ROOT, p)}: ${e.message}`); return fallback; }
};
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'piece';

// ---------- photos ----------
const done = new Map();
async function processPhoto(ref) {
  const rel = str(ref).replace(/^\/+/, '').split('?')[0];
  if (!rel) return null;
  if (done.has(rel)) return done.get(rel);
  const srcPath = path.join(ROOT, rel);
  if (!srcPath.startsWith(ROOT + path.sep) || !existsSync(srcPath)) { warnings.push(`Photo not found: ${rel}`); done.set(rel, null); return null; }
  const base = rel.replace(/\.[^.]+$/, '');
  const out = { small: `${base}-600.jpg`, large: `${base}-1400.jpg` };
  await mkdir(path.join(OUT, path.dirname(rel)), { recursive: true });
  if (sharp) {
    try {
      for (const [key, size] of [['small', 600], ['large', 1400]]) {
        await sharp(srcPath).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: key === 'small' ? 78 : 84, mozjpeg: true }).toFile(path.join(OUT, out[key]));
      }
    } catch (e) { warnings.push(`Could not resize ${rel}: ${e.message}`); done.set(rel, null); return null; }
  } else {
    out.small = out.large = rel;
    await copyFile(srcPath, path.join(OUT, rel));
  }
  done.set(rel, out);
  return out;
}

// ---------- content ----------
const settingsRaw = await readJson(path.join(ROOT, 'content/settings.json'), {});
const settings = {};
for (const k of ['email', 'venmo', 'instagram', 'tiktok', 'turnaround', 'story']) settings[k] = str(settingsRaw[k]);

const pieceDir = path.join(ROOT, 'content/pieces');
const files = existsSync(pieceDir) ? (await readdir(pieceDir)).filter((f) => f.endsWith('.json')).sort() : [];
const pieces = [];
const used = new Set();
for (const f of files) {
  const raw = await readJson(path.join(pieceDir, f), null);
  if (!raw || typeof raw !== 'object') continue;
  if (raw.show === false) continue;
  const name = str(raw.name);
  if (!name) { warnings.push(`${f} has no name, so it was left off the site`); continue; }
  let slug = slugify(f.replace(/\.json$/, '')); while (used.has(slug)) slug += '-2'; used.add(slug);
  const priceNum = raw.price === '' || raw.price == null ? null : Number(raw.price);
  const photoRefs = Array.isArray(raw.photos) ? raw.photos : raw.photos ? [raw.photos] : [];
  const photos = (await Promise.all(photoRefs.map(processPhoto))).filter(Boolean);
  pieces.push({
    slug, name,
    collection: COLLECTIONS.includes(raw.collection) ? raw.collection : 'candy-jade',
    price: Number.isFinite(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) / 100 : null,
    status: STATUSES.includes(raw.status) ? raw.status : 'ready',
    sizes: str(raw.sizes), materials: str(raw.materials), description: str(raw.description),
    photos,
    order: Number.isFinite(Number(raw.order)) && raw.order !== '' && raw.order != null ? Number(raw.order) : 1e9,
  });
}
pieces.sort((a, b) => a.order - b.order || (a.status === 'sold') - (b.status === 'sold') || a.name.localeCompare(b.name));
pieces.forEach((p) => delete p.order);

// ---------- pages ----------
const template = await readFile(path.join(ROOT, 'src/index.html'), 'utf8');
const version = Date.now().toString(36);
const DEFAULT_DESC = 'Handmade beaded bracelets and necklaces by Ashley. Gemstones, pearls and candy-bright jade, strung by hand and designed with you.';
const priceText = (p) => (p.price == null ? '' : `$${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}`);

function page({ base, title, desc, ogImage, open }) {
  const data = JSON.stringify({ base, open: open || null, settings, pieces }).replace(/</g, '\\u003c');
  const og = ogImage ? (SITE_URL !== '/' ? SITE_URL + ogImage : base + ogImage) : (SITE_URL !== '/' ? SITE_URL : base) + 'media/site/logo.jpg';
  const vars = { TITLE: esc(title), DESC: esc(desc), OG_IMAGE: esc(og), BASE: base, VERSION: version, CATALOG: data };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'index.html'), page({ base: '', title: 'Made in the Mood', desc: DEFAULT_DESC }));
for (const p of pieces) {
  const dir = path.join(OUT, 'pieces', p.slug);
  await mkdir(dir, { recursive: true });
  const desc = [priceText(p), p.description || DEFAULT_DESC].filter(Boolean).join(' · ').slice(0, 300);
  await writeFile(path.join(dir, 'index.html'), page({ base: '../../', title: `${p.name} | Made in the Mood`, desc, ogImage: p.photos[0]?.large, open: p.slug }));
}
for (const f of ['style.css', 'app.js']) await copyFile(path.join(ROOT, 'src', f), path.join(OUT, f));
await mkdir(path.join(OUT, 'media/site'), { recursive: true });
for (const f of await readdir(path.join(ROOT, 'media/site'))) {
  if ((await stat(path.join(ROOT, 'media/site', f))).isFile()) await copyFile(path.join(ROOT, 'media/site', f), path.join(OUT, 'media/site', f));
}
await writeFile(path.join(OUT, '.nojekyll'), '');

console.log(`Built ${pieces.length} piece${pieces.length === 1 ? '' : 's'} and ${done.size} photo${done.size === 1 ? '' : 's'}.`);
if (warnings.length) { console.log('Warnings:'); for (const w of warnings) console.log(' - ' + w); }
