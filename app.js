import { alleles, rollTail, isTail, TRAITS } from './allele.js';
import { renderPet, petOf, PET_CSS } from './pets.js';

/* pet keyframes live with the renderer so rapp-pets and rappdex can't drift */
const petStyle = document.createElement('style');
petStyle.textContent = PET_CSS;
document.head.appendChild(petStyle);

const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/* ───────────────────────── tabs ───────────────────────── */
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('is-on', x === t));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('is-on'));
    $('#view-' + t.dataset.view).classList.add('is-on');
    window.scrollTo(0, 0);
  });
});

/* ───────────────────────── the dex ───────────────────────── */
const LIVE = 'https://raw.githubusercontent.com/kody-w/rapp-mapp/main/mapp.json';
let MAP = null, activeLayer = null;

async function loadMap() {
  // Live first so the dex tracks the map; the vendored copy is the offline floor.
  try {
    const r = await fetch(LIVE, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    $('#src').textContent = 'live · rapp-mapp@main';
    return await r.json();
  } catch {
    const r = await fetch('mapp.json');
    $('#src').textContent = 'offline · vendored snapshot';
    return await r.json();
  }
}

function drawChips() {
  const layers = [...new Set(MAP.surfaces.map(s => s.layer))];
  const box = $('#chips'); box.textContent = '';
  layers.forEach(l => {
    const c = el('button', 'chip', esc(l));
    c.addEventListener('click', () => {
      activeLayer = (activeLayer === l) ? null : l;
      [...box.children].forEach(x => x.classList.toggle('is-on', x.textContent === activeLayer));
      draw();
    });
    box.appendChild(c);
  });
}

function draw() {
  const q = ($('#q').value || '').toLowerCase().trim();
  const rows = MAP.surfaces.filter(s => {
    if (activeLayer && s.layer !== activeLayer) return false;
    if (!q) return true;
    return [s.repo, s.layer, s.side, s.houses, s.note].join(' ').toLowerCase().includes(q);
  });

  $('#count').textContent =
    `${rows.length} of ${MAP.surfaces.length} surfaces` + (activeLayer ? ` · ${activeLayer}` : '');

  const grid = $('#grid'); grid.textContent = '';
  rows.forEach(s => {
    const n = String(MAP.surfaces.indexOf(s) + 1).padStart(3, '0');
    const d = el('details', 'card');
    const sideCls = s.side === 'vault' ? 'vault' : s.side === 'bones' ? 'bones' : '';
    d.innerHTML = `
      <summary>
        <span class="num">#${n}</span>
        <span class="repo">${esc(s.repo)}</span>
        <span class="badges">
          ${s.authority ? '<span class="b auth">authority</span>' : ''}
          <span class="b ${sideCls}">${esc(s.side)}</span>
        </span>
      </summary>
      <div class="body">
        <dl>
          <dt>layer</dt><dd>${esc(s.layer)}</dd>
          <dt>houses</dt><dd>${esc(s.houses)}</dd>
          ${s.article ? `<dt>article</dt><dd>${esc(s.article)}</dd>` : ''}
        </dl>
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
        <a class="gh" href="https://github.com/${esc(s.repo)}" target="_blank" rel="noopener">
          open on github &rarr;</a>
      </div>`;
    grid.appendChild(d);
  });

  const gaps = $('#gaps');
  gaps.innerHTML = `<h2>Known gaps &mdash; stated by the map itself</h2><ul>` +
    (MAP.known_gaps || []).map(g =>
      `<li>${esc(typeof g === 'string' ? g : (g.gap || g.note || JSON.stringify(g)))}</li>`).join('') +
    `</ul>`;
}

/* ───────────────────────── pets ───────────────────────── */
async function showPet(tail) {
  const stage = $('#petstage'), list = $('#alleles');
  if (!isTail(tail)) {
    stage.textContent = '';
    list.innerHTML = tail
      ? `<p class="fine">A tail is 64 hex characters. That one is ${tail.trim().length}.</p>`
      : '';
    return;
  }

  const a = await alleles(tail.trim().toLowerCase());
  const pet = petOf(a);

  stage.innerHTML = `
    ${renderPet(a, { id: 'main', size: 210 })}
    <div class="petmeta">
      <div class="petname">${esc(pet.label)}</div>
      <div class="petsub">${esc(pet.pattern)} &middot; bobs every ${pet.period}s</div>
      <span class="tier ${pet.tier}">${pet.tier} aura</span>
    </div>`;

  list.textContent = '';
  TRAITS.forEach(t => {
    const v = a[t.key];
    const row = el('div', 'al');
    row.innerHTML = `
      <span class="t">${esc(v.trait)}</span>
      <span class="v">${esc(v.blurb)} · ${v.bits}-bit</span>
      ${v.tier
        ? `<span class="tier ${v.tier.name}">${v.tier.name} · ${esc(v.tier.odds)}</span>`
        : `<span class="tier common">${esc(v.hex)}</span>`}`;
    list.appendChild(row);
  });
}

/* ───────────────────────── words ───────────────────────── */
function drawWords() {
  const v = MAP.vocabulary || {};
  const box = $('#words');
  box.innerHTML = `<p class="lede">${esc(v.source || 'The Lexicon')}</p>` +
    (v.rules || []).map(r => `<div class="word"><p>${esc(r)}</p></div>`).join('') +
    `<div class="word"><b>membrane</b><p>${esc(Object.keys(MAP.membrane || {}).join(' · '))}</p></div>` +
    `<div class="word"><b>authority</b><p>${esc(MAP.authority_note || '')}</p></div>`;
}

/* ───────────────────────── boot ───────────────────────── */
(async () => {
  MAP = await loadMap();
  drawChips(); draw(); drawWords();
  $('#q').addEventListener('input', draw);

  $('#roll').addEventListener('click', () => { const t = rollTail(); $('#tail').value = t; showPet(t); });
  $('#clear').addEventListener('click', () => { $('#tail').value = ''; showPet(''); });
  $('#tail').addEventListener('input', e => showPet(e.target.value));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  $('#offline-note').textContent =
    'Installable. Add to Home Screen and it keeps working with no network — the map is vendored and every allele is computed on-device.';
})();
