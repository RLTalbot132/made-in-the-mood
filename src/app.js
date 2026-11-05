/* Made in the Mood storefront. The build step writes window.MITM = {base, open, settings, pieces}. */
(function () {
  'use strict';
  var D = window.MITM || {};
  var BASE = D.base || '';
  var S = D.settings || {};
  var PIECES = Array.isArray(D.pieces) ? D.pieces : [];

  var COLLECTIONS = [
    { key: 'candy-jade', name: 'Candy Jade' },
    { key: 'aurum', name: 'Aurum' },
    { key: 'aura', name: 'Aura' }
  ];
  var TYPES = [
    { key: 'necklace', name: 'Necklaces', one: 'Necklace' },
    { key: 'bracelet', name: 'Bracelets', one: 'Bracelet' },
    { key: 'set', name: 'Bracelet sets', one: 'Bracelet set' },
    { key: 'wrap', name: 'Wraps', one: 'Convertible wrap' },
    { key: 'earrings', name: 'Earrings', one: 'Earrings' },
    { key: 'other', name: 'More', one: '' }
  ];
  function typeName(k) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === k) return TYPES[i].one; return ''; }
  function eyebrow(p) { return [colName(p.collection), typeName(p.type)].filter(Boolean).join(' · '); }
  var STATUS = { ready: 'Ready to ship', made: 'Made to order', sold: 'Sold out' };
  var filter = 'all';
  var mood = { mood: '', palettes: [], piece: '' };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, props) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) n.append(x.nodeType ? x : String(x)); });
    }
    return n;
  }
  /* Resolve against the page's address at load, so paths stay right after the URL changes to a piece. */
  var ROOT = new URL(BASE || './', location.href).href;
  function src(path) { return new URL(path, ROOT).href; }
  function money(n) { return typeof n === 'number' ? '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2)) : ''; }
  function colName(k) { for (var i = 0; i < COLLECTIONS.length; i++) if (COLLECTIONS[i].key === k) return COLLECTIONS[i].name; return ''; }
  function handle(s) { return String(s || '').trim().replace(/^@+/, ''); }
  function pieceUrl(p) { return new URL('pieces/' + p.slug + '/', ROOT).href; }

  var EMAIL = String(S.email || '').trim();
  function mailto(subject, body) {
    if (!EMAIL) return ROOT + '#contact';
    return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  var INTRO = 'Hi Ashley,\n\n';
  var DETAILS = '\n\nColors or mood:\nBracelet or necklace:\nSize:\nOccasion and date needed:\n\nThank you!';
  var MAILS = {
    general: function () { return mailto('Hello from Made in the Mood', INTRO + 'I would love to order something.' + DETAILS); },
    custom: function () { return mailto('Custom design request', INTRO + 'I would like you to design something for me. Here is what I have in mind:' + DETAILS); }
  };
  function pieceMail(p) {
    var line = '"' + p.name + '"' + (typeof p.price === 'number' ? ' (' + money(p.price) + ')' : '');
    return mailto('Order: ' + p.name, INTRO + 'I would love to order ' + line + '.\n' + pieceUrl(p) + '\n\nSize:\nAny color changes:\nWhen I need it by:\nShipping zip code:\n\nThank you!');
  }
  function rangeText(key) {
    var prices = PIECES.filter(function (p) { return p.collection === key && typeof p.price === 'number'; }).map(function (p) { return p.price; });
    if (!prices.length) return 'Email Ashley for pricing';
    var lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
    return lo === hi ? money(lo) : money(lo) + ' to ' + money(hi);
  }
  function setCover(box, key, alt) {
    var p = PIECES.filter(function (x) { return x.collection === key && x.photos.length; })[0];
    if (p) box.appendChild(el('img', { src: src(p.photos[0].large), alt: alt, loading: 'lazy' }));
  }

  var toastTimer;
  function toast(text) {
    var t = $('#toast'); t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }
  function copyText(text, btn) {
    function fail() { toast('Copy did not work here. The address is ' + text); }
    try {
      navigator.clipboard.writeText(text).then(function () {
        var o = btn.textContent; btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = o; }, 1600);
      }, fail);
    } catch (e) { fail(); }
  }

  /* ---------- page sections ---------- */
  function renderStatic() {
    $$('[data-mail]').forEach(function (a) { var f = MAILS[a.getAttribute('data-mail')]; if (f) a.setAttribute('href', f()); });
    var v = handle(S.venmo);
    $$('[data-venmo]').forEach(function (a) {
      a.hidden = !v;
      if (v) { a.href = 'https://venmo.com/u/' + encodeURIComponent(v); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Venmo @' + v; }
    });
    setCover($('#cj-photo'), 'candy-jade', 'Candy Jade piece by Made in the Mood');
    setCover($('#aurum-photo'), 'aurum', 'Aurum piece by Made in the Mood');
    setCover($('#aura-photo'), 'aura', 'Aura piece by Made in the Mood');
    $('#cj-price').textContent = rangeText('candy-jade');
    $('#aurum-price').textContent = rangeText('aurum');
    $('#aura-price').textContent = rangeText('aura');
    var t = String(S.turnaround || '').trim();
    $('#turnaround').textContent = t ? ' Typical turnaround: ' + t.replace(/\.$/, '') + '.' : '';
    $$('[data-needs-collection]').forEach(function (n) {
      var key = n.getAttribute('data-needs-collection');
      n.hidden = !PIECES.some(function (p) { return key ? p.collection === key : !!p.collection; });
    });
    var story = $('#story'), st = String(S.story || '').trim();
    story.textContent = st; story.hidden = !st;
    renderContact();
  }

  function renderContact() {
    var list = $('#contact-list'), rows = [];
    if (EMAIL) {
      rows.push(el('div', { class: 'contact-row' },
        el('a', { href: MAILS.general() }, EMAIL),
        el('button', { type: 'button', class: 'copy-btn', onclick: function (ev) { copyText(EMAIL, ev.currentTarget); } }, 'Copy address')));
    }
    var v = handle(S.venmo), ig = handle(S.instagram), tt = handle(S.tiktok);
    if (v) rows.push(el('a', { href: 'https://venmo.com/u/' + encodeURIComponent(v), target: '_blank', rel: 'noopener' }, 'Venmo @' + v));
    if (ig) rows.push(el('a', { href: 'https://instagram.com/' + encodeURIComponent(ig), target: '_blank', rel: 'noopener' }, 'Instagram @' + ig));
    var etsy = String(S.etsy || '').trim();
    if (/^https:\/\/(www\.)?etsy\.com\//.test(etsy)) rows.push(el('a', { href: etsy, target: '_blank', rel: 'noopener' }, 'Shop on Etsy'));
    if (tt) rows.push(el('a', { href: 'https://www.tiktok.com/@' + encodeURIComponent(tt), target: '_blank', rel: 'noopener' }, 'TikTok @' + tt));
    list.replaceChildren.apply(list, rows);
  }

  function renderShop() {
    var counts = {};
    PIECES.forEach(function (p) { counts[p.type] = (counts[p.type] || 0) + 1; if (p.collection) counts[p.collection] = (counts[p.collection] || 0) + 1; });
    var opts = [{ key: 'all', name: 'All pieces' }].concat(TYPES.filter(function (c) { return counts[c.key]; }), COLLECTIONS.filter(function (c) { return counts[c.key]; }));
    if (!opts.some(function (o) { return o.key === filter; })) filter = 'all';
    var box = $('#shop-filters');
    box.replaceChildren.apply(box, opts.length > 2 ? opts.map(function (o) {
      return el('button', { type: 'button', class: 'pill', 'aria-pressed': String(filter === o.key), onclick: function () { filter = o.key; renderShop(); } }, o.name);
    }) : []);
    var shown = PIECES.filter(function (p) { return filter === 'all' || p.type === filter || p.collection === filter; });
    var grid = $('#shop-grid');
    grid.replaceChildren.apply(grid, shown.map(card));
    grid.hidden = shown.length === 0;
    $('#shop-empty').hidden = shown.length > 0;
    $('#shop-empty-text').textContent = 'New pieces are on the way. Follow along on TikTok, or email Ashley to design something now.';
  }

  function card(p) {
    var cover = p.photos[0];
    var img = el('span', { class: 'card-img photo-box' }, cover
      ? el('img', { src: src(cover.small), alt: '', loading: 'lazy' })
      : el('span', { class: 'initial', 'aria-hidden': 'true' }, (p.name || '?').charAt(0)));
    var price = el('span', { class: 'card-price' },
      el('span', null, typeof p.price === 'number' ? money(p.price) : 'Ask for price'),
      p.status !== 'ready' ? el('span', { class: 'chip' }, STATUS[p.status]) : null);
    var a = el('a', { class: 'card-open', href: pieceUrl(p), onclick: function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      ev.preventDefault(); openPiece(p, true);
    } }, img, el('span', { class: 'card-text' },
      el('span', { class: 'card-col' }, eyebrow(p)),
      el('span', { class: 'card-name' }, p.name),
      price));
    return el('div', { class: 'card' }, a);
  }

  function renderMood() {
    function pills(box, opts, isOn, pick) {
      box.replaceChildren.apply(box, opts.map(function (label) {
        return el('button', { type: 'button', class: 'pill', 'aria-pressed': String(isOn(label)), onclick: function () { pick(label); renderMood(); } }, label);
      }));
    }
    pills($('#mood-moods'), ['Playful', 'Cozy', 'Elegant', 'Bold'], function (l) { return mood.mood === l; }, function (l) { mood.mood = mood.mood === l ? '' : l; });
    pills($('#mood-palettes'), ['Candy bright', 'Earthy neutrals', 'Soft pastels', 'Gold and pearl', 'Jewel tones'], function (l) { return mood.palettes.indexOf(l) >= 0; }, function (l) {
      mood.palettes = mood.palettes.indexOf(l) >= 0 ? mood.palettes.filter(function (x) { return x !== l; }) : mood.palettes.concat([l]);
    });
    pills($('#mood-pieces'), ['Bracelet', 'Necklace', 'Both', 'Not sure yet'], function (l) { return mood.piece === l; }, function (l) { mood.piece = mood.piece === l ? '' : l; });
    var parts = [mood.mood, mood.palettes.join(', '), mood.piece].filter(Boolean);
    $('#mood-summary').textContent = parts.length ? parts.join(' · ') : 'Pick a mood, some colors and a piece to get started.';
    var body = INTRO + 'Here is my mood:\n\nMood: ' + (mood.mood || 'Not sure yet') + '\nColors I love: ' + (mood.palettes.length ? mood.palettes.join(', ') : 'Not sure yet') + '\nI am looking for: ' + (mood.piece || 'Not sure yet') + '\n\nSize:\nOccasion and date needed:\n\nThank you!';
    $('#mood-send').setAttribute('href', mailto(mood.mood ? 'My mood: ' + mood.mood : 'My mood', body));
  }

  /* ---------- piece detail ---------- */
  var homeUrl = location.href;
  function openPiece(p, push) {
    var main = el('div', { class: 'pd-main photo-box' }, p.photos[0] ? el('img', { src: src(p.photos[0].large), alt: p.name }) : null);
    var thumbs = p.photos.length > 1 ? el('div', { class: 'pd-thumbs' }, p.photos.map(function (ph, i) {
      return el('button', { type: 'button', class: 'pd-thumb', 'aria-label': 'Photo ' + (i + 1) + ' of ' + p.photos.length, 'aria-current': String(i === 0), onclick: function (ev) {
        $$('.pd-thumb', thumbs).forEach(function (b) { b.setAttribute('aria-current', 'false'); });
        ev.currentTarget.setAttribute('aria-current', 'true');
        main.replaceChildren(el('img', { src: src(ph.large), alt: p.name + ', photo ' + (i + 1) }));
      } }, el('img', { src: src(ph.small), alt: '' }));
    })) : null;
    var facts = [];
    if (p.materials) facts.push(el('dt', null, 'Materials'), el('dd', null, p.materials));
    if (p.sizes) facts.push(el('dt', null, 'Sizes'), el('dd', null, p.sizes));
    facts.push(el('dt', null, 'Availability'), el('dd', null, STATUS[p.status]));
    var v = handle(S.venmo);
    var ask = el('div', { class: 'pd-ask' },
      p.status === 'sold'
        ? el('a', { class: 'btn btn-dark', href: mailto('Something like ' + p.name, INTRO + 'I love "' + p.name + '". Could you make something like it for me?' + DETAILS) }, 'Ask for one like it')
        : el('a', { class: 'btn btn-dark', href: pieceMail(p) }, 'Email Ashley to order'),
      p.etsy && p.status !== 'sold' ? el('a', { class: 'btn btn-ghost', href: p.etsy, target: '_blank', rel: 'noopener' }, 'Buy on Etsy') : null,
      EMAIL ? el('p', null, 'Or write to ' + EMAIL + '.') : null,
      EMAIL ? el('button', { type: 'button', class: 'btn-text', onclick: function (ev) { copyText(EMAIL, ev.currentTarget); } }, 'Copy email address') : null,
      el('p', null, 'Ashley replies personally to confirm size and shipping.' + (v ? ' Payment is by Venmo @' + v + ' once you have agreed on the details.' : '')));
    $('#pd-body').replaceChildren(
      el('div', { style: 'min-width:0' }, main, thumbs),
      el('div', { class: 'pd-info' },
        el('p', { class: 'eyebrow' }, eyebrow(p)),
        el('h2', { id: 'pd-name' }, p.name),
        el('div', { class: 'pd-price' },
          el('span', null, typeof p.price === 'number' ? money(p.price) : 'Ask for price'),
          el('span', { class: 'chip' + (p.status === 'ready' ? ' chip-ok' : '') }, STATUS[p.status])),
        p.description ? el('p', { class: 'pd-desc' }, p.description) : null,
        el('dl', { class: 'facts' }, facts),
        ask));
    var d = $('#piece');
    if (!d.open) d.showModal();
    if (push) { try { history.pushState({ piece: p.slug }, '', pieceUrl(p)); } catch (e) {} }
  }
  $('#piece').addEventListener('close', function () {
    if (history.state && history.state.piece) { try { history.back(); } catch (e) {} }
  });
  window.addEventListener('popstate', function () {
    var d = $('#piece');
    if (d.open && !(history.state && history.state.piece)) d.close();
  });
  $$('dialog [data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });
  $$('dialog').forEach(function (d) { d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); }); });
  $$('[data-filter]').forEach(function (a) {
    a.addEventListener('click', function () { filter = a.getAttribute('data-filter'); renderShop(); });
  });

  renderStatic();
  renderShop();
  renderMood();
  if (D.open) {
    var p = PIECES.filter(function (x) { return x.slug === D.open; })[0];
    if (p) openPiece(p, false);
  }
})();
