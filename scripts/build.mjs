// Builds the static site into _site/ from content/ (edited by Ashley in Pages CMS) and src/.
// Photos are resized here, so Ashley can upload straight from her phone.
import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, '/');
const COLLECTIONS = ['candy-jade']; // Aurum and Aura are on the back burner
const TYPES = ['necklace', 'bracelet', 'set', 'wrap', 'earrings', 'other'];
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
for (const k of ['email', 'venmo', 'instagram', 'tiktok', 'etsy', 'turnaround', 'story']) settings[k] = str(settingsRaw[k]);

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
    collection: COLLECTIONS.includes(raw.collection) ? raw.collection : '',
    type: TYPES.includes(raw.type) ? raw.type : 'other',
    etsy: /^https:\/\/(www\.)?etsy\.com\//.test(str(raw.etsy)) ? str(raw.etsy) : '',
    price: Number.isFinite(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) / 100 : null,
    status: STATUSES.includes(raw.status) ? raw.status : 'ready',
    sizes: str(raw.sizes), materials: str(raw.materials), description: str(raw.description),
    photos,
    order: Number.isFinite(Number(raw.order)) && raw.order !== '' && raw.order != null ? Number(raw.order) : 1e9,
  });
}
pieces.sort((a, b) => a.order - b.order || (a.status === 'sold') - (b.status === 'sold') || a.name.localeCompare(b.name));
pieces.forEach((p) => delete p.order);

// ---------- links: accept a handle or a pasted link ----------
function linkFor(kind, raw) {
  const v = str(raw);
  if (!v) return null;
  const isUrl = /^https?:\/\//i.test(v);
  let u = null;
  if (isUrl) { try { u = new URL(v); } catch { return null; } }
  const seg = u ? u.pathname.split('/').filter(Boolean) : [];
  if (kind === 'venmo') {
    const h = u ? (seg[0] === 'u' ? seg[1] : (seg[0] && seg[0] !== 'code' ? seg[0] : '')) : v.replace(/^@+/, '');
    return { url: h ? `https://venmo.com/u/${encodeURIComponent(h)}` : u.href, label: h ? `Venmo @${h}` : 'Pay with Venmo', handle: h || '' };
  }
  if (kind === 'instagram') {
    const h = u ? (seg[0] || '') : v.replace(/^@+/, '');
    return h ? { url: `https://www.instagram.com/${encodeURIComponent(h)}/`, label: `Instagram @${h}`, handle: h } : null;
  }
  if (kind === 'tiktok') {
    const h = u ? (seg[0] || '').replace(/^@/, '') : v.replace(/^@+/, '');
    return h ? { url: `https://www.tiktok.com/@${encodeURIComponent(h)}`, label: `TikTok @${h}`, handle: h } : null;
  }
  if (kind === 'etsy') return /^https:\/\/(www\.)?etsy\.com\//.test(v) ? { url: v, label: 'Shop on Etsy' } : null;
  return null;
}
settings.links = {};
for (const k of ['venmo', 'instagram', 'tiktok', 'etsy']) { const l = linkFor(k, settings[k]); if (l) settings.links[k] = l; }

// ---------- pages ----------
const template = await readFile(path.join(ROOT, 'src/index.html'), 'utf8');
const version = Date.now().toString(36);
const today = new Date().toISOString().slice(0, 10);
const ORIGIN = SITE_URL !== '/' ? SITE_URL : '';
const abs = (rel) => (ORIGIN ? ORIGIN + rel : rel);
const DEFAULT_DESC = 'Colorful, easy-to-wear gemstone jewelry with playful details and a little personality, designed and assembled by hand by Ashley in Utah.';
const STATUS_LABEL = { ready: 'Ready to ship', made: 'Made to order', sold: 'Sold out' };
const AVAIL = { ready: 'https://schema.org/InStock', made: 'https://schema.org/MadeToOrder', sold: 'https://schema.org/SoldOut' };
const TYPE_LABEL = { necklace: 'Necklace', bracelet: 'Bracelet', set: 'Bracelet set', wrap: 'Convertible wrap', earrings: 'Earrings', other: '' };
const priceText = (p) => (p.price == null ? '' : `$${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}`);
const eyebrow = (p) => [p.collection === 'candy-jade' ? 'Candy Jade' : '', TYPE_LABEL[p.type]].filter(Boolean).join(' · ');
const sameAs = ['etsy', 'instagram', 'tiktok'].map((k) => settings.links[k]?.url).filter(Boolean);
const STORE_ID = abs('#store'), PERSON_ID = abs('#ashley');

function cardHtml(p, base) {
  const cover = p.photos[0];
  const img = cover
    ? `<img src="${esc(base + cover.small)}" alt="" width="600" height="600" loading="lazy" decoding="async">`
    : `<span class="initial" aria-hidden="true">${esc(p.name.charAt(0))}</span>`;
  const chip = p.status !== 'ready' ? `<span class="chip">${STATUS_LABEL[p.status]}</span>` : '';
  return `<div class="card"><a class="card-open" href="${esc(base)}pieces/${p.slug}/"><span class="card-img photo-box">${img}</span><span class="card-text"><span class="card-col">${esc(eyebrow(p))}</span><h3 class="card-name">${esc(p.name)}</h3><span class="card-price"><span>${p.price == null ? 'Ask for price' : priceText(p)}</span>${chip}</span></span></a></div>`;
}

function pieceHtml(p, base) {
  const main = p.photos[0] ? `<img src="${esc(base + p.photos[0].large)}" alt="${esc(p.name)}" width="1400" height="1400" fetchpriority="high">` : '';
  const thumbs = p.photos.length > 1 ? `<div class="pd-thumbs">${p.photos.map((ph, i) =>
    `<button type="button" class="pd-thumb" aria-label="Photo ${i + 1} of ${p.photos.length}" aria-current="${i === 0}" data-large="${esc(base + ph.large)}" data-alt="${esc(`${p.name}, photo ${i + 1}`)}"><img src="${esc(base + ph.small)}" alt="" width="600" height="600" loading="lazy"></button>`).join('')}</div>` : '';
  const facts = [p.materials && ['Materials', p.materials], p.sizes && ['Sizes', p.sizes], ['Availability', STATUS_LABEL[p.status]]]
    .filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const email = settings.email;
  const ask = [
    `<a class="btn btn-dark" data-piece-mail href="${email ? 'mailto:' + esc(email) : '#contact'}">${p.status === 'sold' ? 'Ask for one like it' : 'Email Ashley to order'}</a>`,
    p.etsy && p.status !== 'sold' ? `<a class="btn btn-ghost" href="${esc(p.etsy)}" target="_blank" rel="noopener">Buy on Etsy</a>` : '',
    email ? `<p>Or write to ${esc(email)}.</p><button type="button" class="btn-text" data-copy-email>Copy email address</button>` : '',
    `<p>Ashley replies personally to confirm size and shipping.${settings.links.venmo ? ' Payment is by Venmo once you have agreed on the details.' : ''}</p>`,
  ].join('');
  return `<section id="piece-page" class="wrap" aria-labelledby="piece-title">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${esc(base)}">Made in the Mood</a> <span aria-hidden="true">/</span> <a href="${esc(base)}#shop">Shop</a> <span aria-hidden="true">/</span> <span aria-current="page">${esc(p.name)}</span></nav>
<article class="pd">
<div style="min-width:0"><div class="pd-main photo-box">${main}</div>${thumbs}</div>
<div class="pd-info">
<p class="eyebrow">${esc(eyebrow(p))}</p>
<h1 id="piece-title">${esc(p.name)}</h1>
<div class="pd-price"><span>${p.price == null ? 'Ask for price' : priceText(p)}</span><span class="chip${p.status === 'ready' ? ' chip-ok' : ''}">${STATUS_LABEL[p.status]}</span></div>
${p.description ? `<p class="pd-desc">${esc(p.description)}</p>` : ''}
<dl class="facts">${facts}</dl>
<div class="pd-ask">${ask}</div>
</div>
</article>
</section>`;
}

const storeLd = {
  '@type': ['OnlineStore', 'Organization'], '@id': STORE_ID, name: 'Made in the Mood', alternateName: 'Made in the Mood Jewelry',
  url: abs(''), logo: abs('media/site/logo.jpg'), image: abs('media/site/banner.jpg'), slogan: 'Choose your mood',
  description: DEFAULT_DESC, ...(settings.email ? { email: settings.email } : {}),
  founder: { '@id': PERSON_ID }, address: { '@type': 'PostalAddress', addressRegion: 'UT', addressCountry: 'US' },
  ...(sameAs.length ? { sameAs } : {}),
};
const personLd = { '@type': 'Person', '@id': PERSON_ID, name: 'Ashley', jobTitle: 'Jewelry designer and maker', worksFor: { '@id': STORE_ID }, ...(settings.links.instagram ? { sameAs: [settings.links.instagram.url] } : {}) };
const productLd = (p) => ({
  '@type': 'Product', '@id': abs(`pieces/${p.slug}/#product`), name: p.name, url: abs(`pieces/${p.slug}/`), sku: p.slug,
  image: p.photos.map((ph) => abs(ph.large)), description: p.description || undefined,
  brand: { '@type': 'Brand', name: 'Made in the Mood' }, category: TYPE_LABEL[p.type] || 'Jewelry', material: p.materials || undefined,
  ...(p.price != null ? { offers: { '@type': 'Offer', price: p.price.toFixed(2), priceCurrency: 'USD', availability: AVAIL[p.status], url: abs(`pieces/${p.slug}/`), seller: { '@id': STORE_ID } } } : {}),
});
const ld = (graph) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;

function page({ base, rel, title, desc, ogImage, open, graph, body }) {
  const data = JSON.stringify({ base, open: open || null, settings, pieces }).replace(/</g, '\\u003c');
  const og = abs(ogImage || 'media/site/banner.jpg');
  const vars = {
    TITLE: esc(title), DESC: esc(desc), OG_IMAGE: esc(og), BASE: base, VERSION: version, CATALOG: data,
    CANONICAL: esc(abs(rel)), JSONLD: ld(graph), SHOP_CARDS: pieces.map((p) => cardHtml(p, base)).join(''),
    PIECE_SECTION: body || '', BODY_CLASS: open ? 'is-piece' : '',
  };
  let html = template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  if (open) html = html.replace('<h1>Choose your mood.</h1>', '<p class="hero-title">Choose your mood.</p>');
  return html;
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'index.html'), page({
  base: '', rel: '', title: 'Made in the Mood | Handmade Gemstone Jewelry from Utah', desc: DEFAULT_DESC,
  graph: [storeLd, personLd, { '@type': 'WebSite', '@id': abs('#website'), url: abs(''), name: 'Made in the Mood', publisher: { '@id': STORE_ID } },
    { '@type': 'ItemList', name: 'Pieces', itemListElement: pieces.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`pieces/${p.slug}/`), name: p.name })) }],
}));
for (const p of pieces) {
  const dir = path.join(OUT, 'pieces', p.slug);
  await mkdir(dir, { recursive: true });
  const desc = [priceText(p), (p.description || DEFAULT_DESC).replace(/\s+/g, ' ')].filter(Boolean).join(' · ').slice(0, 300);
  await writeFile(path.join(dir, 'index.html'), page({
    base: '../../', rel: `pieces/${p.slug}/`, title: `${p.name} | Made in the Mood`, desc, ogImage: p.photos[0]?.large, open: p.slug,
    body: pieceHtml(p, '../../'),
    graph: [productLd(p), storeLd, { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Made in the Mood', item: abs('') },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: abs('#shop') },
      { '@type': 'ListItem', position: 3, name: p.name, item: abs(`pieces/${p.slug}/`) }] }],
  }));
}

// ---------- crawler files ----------
const urls = [abs(''), ...pieces.map((p) => abs(`pieces/${p.slug}/`))];
await writeFile(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];
await writeFile(path.join(OUT, 'robots.txt'), `# Made in the Mood welcomes search engines and AI assistants.\n${AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}\n\nUser-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
const md = (s) => String(s).replace(/\s+/g, ' ').trim();
await writeFile(path.join(OUT, 'llms.txt'), [
  '# Made in the Mood', '',
  `> ${DEFAULT_DESC}`, '',
  'Made in the Mood is a small jewelry studio run by Ashley in Utah. She makes playful, easy-to-wear pieces and bold statement designs from gemstones, pearls, Czech glass and handmade beads. Customers order by email and pay by Venmo, or buy through her Etsy shop. Custom designs are welcome.', '',
  '## Pieces', '',
  ...pieces.map((p) => `- [${p.name}](${abs(`pieces/${p.slug}/`)}): ${[TYPE_LABEL[p.type], priceText(p), STATUS_LABEL[p.status]].filter(Boolean).join(', ')}. ${md(p.description).slice(0, 180)}${md(p.description).length > 180 ? '…' : ''}`),
  '', '## Ordering', '',
  `- Email: ${settings.email || 'see the website'}`,
  ...(settings.turnaround ? [`- Typical turnaround: ${settings.turnaround.trim()}`] : []),
  ...['etsy', 'instagram', 'tiktok'].filter((k) => settings.links[k]).map((k) => `- ${settings.links[k].label}: ${settings.links[k].url}`),
  '',
].join('\n'));
const indexNowKey = existsSync(path.join(ROOT, 'indexnow-key.txt')) ? str(await readFile(path.join(ROOT, 'indexnow-key.txt'), 'utf8')) : '';
if (/^[a-f0-9]{32}$/.test(indexNowKey)) await writeFile(path.join(OUT, `${indexNowKey}.txt`), indexNowKey);

for (const f of ['style.css', 'app.js']) await copyFile(path.join(ROOT, 'src', f), path.join(OUT, f));
await mkdir(path.join(OUT, 'media/site'), { recursive: true });
for (const f of await readdir(path.join(ROOT, 'media/site'))) {
  if ((await stat(path.join(ROOT, 'media/site', f))).isFile()) await copyFile(path.join(ROOT, 'media/site', f), path.join(OUT, 'media/site', f));
}
await writeFile(path.join(OUT, '.nojekyll'), '');

console.log(`Built ${pieces.length} piece${pieces.length === 1 ? '' : 's'} and ${done.size} photo${done.size === 1 ? '' : 's'}.`);
if (warnings.length) { console.log('Warnings:'); for (const w of warnings) console.log(' - ' + w); }
