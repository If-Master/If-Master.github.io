const TOKEN_KEY  = 'gh_pat';
const CACHE_TTL  = 24 * 60 * 60 * 1000;   
const CACHE_PFX  = 'ghc:';                 
const SHA_KEY    = 'gh_sha_store';         

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) {
  t ? localStorage.setItem(TOKEN_KEY, t.trim())
    : localStorage.removeItem(TOKEN_KEY);
}

function cacheGet(url) {
  try {
    const raw = localStorage.getItem(CACHE_PFX + url);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PFX + url);
      return null;
    }
    return data;
  } catch { return null; }
}

function cacheSet(url, data) {
  try {
    localStorage.setItem(CACHE_PFX + url, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function shaStore() {
  try { return JSON.parse(localStorage.getItem(SHA_KEY) || '{}'); } catch { return {}; }
}
function getStoredSha(url)      { return shaStore()[url] ?? null; }
function setStoredSha(url, sha) {
  const s = shaStore();
  s[url] = sha;
  localStorage.setItem(SHA_KEY, JSON.stringify(s));
}

let rateLimited = false;

async function ghFetch(url) {
  const cached = cacheGet(url);
  if (cached !== null) return cached;

  const headers = { Accept: 'application/vnd.github+json' };
  const tok = getToken();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;

  const r = await fetch(url, { headers });

  if (r.status === 403 || r.status === 429) {
    rateLimited = true;
    showRateLimitBanner();
    return null;
  }
  if (!r.ok) return null;

  const data = await r.json();

  if (url.includes('/contents/') && data?.sha) {
    const prevSha = getStoredSha(url);
    if (prevSha && prevSha !== data.sha) {
      console.info(`[GH Cache] Change detected: ${url.split('/contents/')[1]} (${prevSha.slice(0,7)} → ${data.sha.slice(0,7)})`);
    }
    setStoredSha(url, data.sha);
  }

  cacheSet(url, data);
  return data;
}

function showRateLimitBanner() {
  if (document.getElementById('rate-limit-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'rate-limit-banner';
  banner.style.cssText = `
    position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);
    background:#1a1a2e;border:1px solid #f7a24f;border-radius:10px;
    padding:.85rem 1.25rem;z-index:9999;max-width:520px;width:calc(100% - 2.5rem);
    font-family:'DM Sans',sans-serif;font-size:.82rem;color:#f7a24f;
    box-shadow:0 8px 32px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:.6rem;`;
  banner.innerHTML = `
    <strong style="font-size:.9rem;">⚠ GitHub API rate limit reached</strong>
    <span style="color:#7a91b5;">
      GitHub allows 60 unauthenticated requests/hour per IP.
      Paste a <a href="https://github.com/settings/tokens/new?description=Portfolio+reader&scopes=public_repo"
      target="_blank" style="color:#4f8ef7;">read-only PAT</a> to get 5,000/hr.
      Your token stays in <em>your</em> browser only.
    </span>
    <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
      <input id="pat-input" type="password" placeholder="ghp_…" value="${getToken()}"
        style="flex:1;min-width:180px;padding:7px 10px;border-radius:6px;border:1px solid #2e5590;
               background:#07101f;color:#e8edf5;font-family:inherit;font-size:.82rem;outline:none;"/>
      <button onclick="applyToken()" style="
        padding:7px 14px;border-radius:6px;background:#4f8ef7;color:#fff;border:none;
        cursor:pointer;font-family:inherit;font-size:.82rem;font-weight:600;">Save &amp; Reload</button>
      <button onclick="dismissBanner()" style="
        padding:7px 10px;border-radius:6px;background:transparent;color:#7a91b5;
        border:1px solid #1e3057;cursor:pointer;font-family:inherit;font-size:.82rem;">Dismiss</button>
    </div>`;
  document.body.appendChild(banner);
}

function applyToken() {
  setToken(document.getElementById('pat-input')?.value?.trim());
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PFX))
    .forEach(k => localStorage.removeItem(k));
  location.reload();
}

function dismissBanner() {
  document.getElementById('rate-limit-banner')?.remove();
}

function injectTokenBtn() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const active = !!getToken();
  const btn    = document.createElement('button');
  btn.id        = 'token-btn';
  btn.title     = active
    ? 'GitHub token active - click to change'
    : 'Add GitHub token for higher rate limits';
  btn.style.cssText = `
    margin-left:.5rem;padding:5px 11px;border-radius:8px;
    font-size:.75rem;font-weight:600;cursor:pointer;
    border:1px solid ${active ? '#4f8ef7' : '#1e3057'};
    background:${active ? 'rgba(79,142,247,.15)' : 'transparent'};
    color:${active ? '#4f8ef7' : '#7a91b5'};
    font-family:'DM Sans',sans-serif;transition:all .2s;white-space:nowrap;`;
  btn.textContent = active ? '🔑 Token active' : '🔑 Add token';
  btn.onclick = () =>
    document.getElementById('rate-limit-banner') ? dismissBanner() : showRateLimitBanner();
  nav.appendChild(btn);
}

if (window.SHOW_REDACTED) document.getElementById('tab-redacted').style.display = '';

function switchPage(id, btn) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.page-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
}

function toggleSection(id, btn) {
  const panel = document.getElementById('panel-' + id);
  const open  = panel.classList.contains('open');
  panel.classList.toggle('open', !open);
  btn.classList.toggle('active', !open);
  if (!open) {
    setTimeout(() => {
      panel.querySelectorAll('.anim-item').forEach(el => {
        el.classList.remove('visible', 'exit');
        scrollObserver.observe(el);
      });
    }, 50);
  }
}

function switchPluginTab(id, btn) {
  document.querySelectorAll('.plugin-panel').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.plugin-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('pluginpanel-' + id).classList.add('open');
  btn.classList.add('active');
}

const scrollObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const el = entry.target;
    if (entry.isIntersecting) {
      el.dataset.seen = '1';
      el.classList.remove('exit');
      el.classList.add('visible');
    } else if (el.dataset.seen) {
      el.classList.remove('visible');
      el.classList.add('exit');
    }
  });
}, { threshold: 0.12 });

function observeAnimItems() {
  document.querySelectorAll('.anim-item').forEach(el => scrollObserver.observe(el));
}

async function fetchConfigYml(repo) {
  for (const path of window.CONFIG_PATHS) {
    const d = await ghFetch(`https://api.github.com/repos/${repo}/contents/${path}`);
    if (d?.content) return atob(d.content.replace(/\n/g, ''));
  }
  return null;
}

async function fetchReleases(repo) {
  const d = await ghFetch(`https://api.github.com/repos/${repo}/releases?per_page=10`);
  return Array.isArray(d) ? d : [];
}

function extractStable(releases) {
  const r = releases.find(r => !r.prerelease);
  if (!r?.assets) return null;
  const jar = r.assets.find(a => a.name.endsWith('.jar'));
  return jar ? { name: jar.name, url: jar.browser_download_url, version: r.tag_name } : null;
}

function extractBeta(releases) {
  const r = releases.find(r => r.prerelease);
  if (!r?.assets) return null;
  const jar = r.assets.find(a => a.name.endsWith('.jar'));
  return jar
    ? { name: jar.name, url: jar.browser_download_url, version: r.tag_name, releaseUrl: r.html_url }
    : null;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightYaml(raw) {
  return raw.split('\n').map(line => {
    const e = esc(line);
    if (!e.trim()) return e;
    if (/^\s*#/.test(e)) return `<span class="hl-comment">${e}</span>`;
    const lm = e.match(/^(\s*)(- )(.*)$/);
    if (lm) return `${lm[1]}<span class="hl-list">${lm[2]}</span>${colorValue(lm[3])}`;
    const kv = e.match(/^(\s*)([\w\-\.]+)(\s*:\s*)(.*)$/);
    if (kv) return `${kv[1]}<span class="hl-key">${kv[2]}</span><span class="hl-colon">${kv[3]}</span>${colorValue(kv[4])}`;
    return `<span class="hl-value">${e}</span>`;
  }).join('\n');
}

function colorValue(val) {
  if (!val?.trim()) return val;
  const ci = val.search(/ #/);
  let main = val, com = '';
  if (ci !== -1) {
    main = val.slice(0, ci);
    com  = `<span class="hl-comment">${val.slice(ci)}</span>`;
  }
  const t = main.trim();
  if (/^["']/.test(t))                         return `<span class="hl-string">${main}</span>${com}`;
  if (/^(true|false|yes|no|null|~)$/i.test(t)) return `<span class="hl-bool">${main}</span>${com}`;
  if (/^-?\d+(\.\d+)?$/.test(t))              return `<span class="hl-num">${main}</span>${com}`;
  return `<span class="hl-value">${main}</span>${com}`;
}

function syncHighlight(uid) {
  const ta  = document.getElementById(uid);
  const pre = document.getElementById('pre-' + uid);
  if (!ta || !pre) return;
  pre.innerHTML = highlightYaml(ta.value) + '\n';
  syncScroll(uid);
}

function syncScroll(uid) {
  const ta  = document.getElementById(uid);
  const pre = document.getElementById('pre-' + uid);
  if (!ta || !pre) return;
  pre.scrollTop  = ta.scrollTop;
  pre.scrollLeft = ta.scrollLeft;
}

function handleTab(e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = e.target, s = ta.selectionStart, en = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
  ta.selectionStart = ta.selectionEnd = s + 2;
  syncHighlight(ta.id);
}

function downloadConfig(uid) {
  const ta = document.getElementById(uid);
  if (!ta) return;
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([ta.value], { type: 'text/yaml' }));
  a.download = 'config.yml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function toggleDrawer(cardEl, repo, spigotUrl, betaRepo) {
  const btn    = cardEl.querySelector('.expand-btn');
  const drawer = cardEl.querySelector('.plugin-drawer');
  const isOpen = drawer.classList.contains('open');

  if (isOpen) { drawer.classList.remove('open'); btn.classList.remove('open'); return; }

  drawer.classList.add('open');
  btn.classList.add('open');
  if (drawer.dataset.loaded) return;
  drawer.dataset.loaded = '1';

  const inner = drawer.querySelector('.plugin-drawer-inner');
  inner.innerHTML = '<span class="drawer-loading">Loading data from GitHub…</span>';

  const uid = 'cfg-' + repo.replace(/\//g, '-');

  Promise.all([
    fetchConfigYml(repo),
    fetchReleases(repo),
  ]).then(([config, releases]) => {
    if (rateLimited) {
      inner.innerHTML = `<p class="drawer-no-item" style="color:#f7a24f;">
        ⚠ Rate limit hit - add a token (🔑) to load content.</p>`;
      return;
    }

    const release = extractStable(releases);
    const beta    = betaRepo ? extractBeta(releases) : null;
    let html = '';

    html += `<span class="drawer-section-label">config.yml</span>`;
    if (config) {
      html += `<span class="config-hint">You can edit this config before downloading</span>`;
      html += `<div class="config-editor-wrap">`;
      html +=   `<pre class="config-highlight" id="pre-${uid}" aria-hidden="true"></pre>`;
      html +=   `<textarea class="config-editor" id="${uid}" spellcheck="false"
                   oninput="syncHighlight('${uid}')" onscroll="syncScroll('${uid}')"
                   onkeydown="handleTab(event)">${esc(config)}</textarea>`;
      html += `</div>`;
      html += `<div class="drawer-actions">`;
      html +=   `<button class="download-btn" onclick="downloadConfig('${uid}')">⬇ Download config.yml</button>`;
      html +=   `<button class="download-btn secondary" id="reset-${uid}">↺ Reset</button>`;
      html += `</div>`;
    } else {
      html += `<p class="drawer-no-item">No config.yml found in this repository.</p>`;
    }

    html += `<span class="drawer-section-label" style="margin-top:1.5rem;display:block;">`;
    html +=   `Stable Release${release ? ' — ' + release.version : ''}`;
    html += `</span>`;
    if (release) {
      html += `<div class="drawer-actions">`;
      html +=   `<a class="download-btn" href="${release.url}" download target="_blank">⬇ Download ${esc(release.name)}</a>`;
      if (spigotUrl) {
        html += `<a class="download-btn spigot-btn" href="${esc(spigotUrl)}" target="_blank">`;
        html +=   `<img src="https://static.spigotmc.org/img/spigot.png" class="spigot-icon" alt=""> Download on Spigot`;
        html += `</a>`;
      }
      html += `</div>`;
    } else {
      html += `<p class="drawer-no-item">No stable release published yet.</p>`;
      if (spigotUrl) {
        html += `<div class="drawer-actions" style="margin-top:.5rem;">`;
        html +=   `<a class="download-btn spigot-btn" href="${esc(spigotUrl)}" target="_blank">`;
        html +=     `<img src="https://static.spigotmc.org/img/spigot.png" class="spigot-icon" alt=""> View on Spigot`;
        html +=   `</a>`;
        html += `</div>`;
      }
    }

    if (betaRepo != null) {
      html += `<span class="drawer-section-label beta-label" style="margin-top:1.5rem;display:block;">`;
      html +=   `Beta / Pre-release${beta ? ' — ' + beta.version : ''}`;
      html += `</span>`;
      if (beta) {
        html += `<div class="drawer-actions">`;
        html +=   `<a class="download-btn beta-btn" href="${beta.url}" download target="_blank">⚡ Download Beta ${esc(beta.name)}</a>`;
        html +=   `<a class="download-btn secondary" href="${esc(beta.releaseUrl)}" target="_blank">Release Notes ↗</a>`;
        html += `</div>`;
        html += `<p class="beta-warning">⚠ Beta builds may be unstable. Use in production at your own risk.</p>`;
      } else {
        html += `<p class="drawer-no-item">No beta / pre-release available at the moment.</p>`;
      }
    }

    inner.innerHTML = html;

    if (config) {
      syncHighlight(uid);
      const ta   = document.getElementById(uid);
      const orig = ta.value;
      document.getElementById('reset-' + uid).onclick = () => { ta.value = orig; syncHighlight(uid); };
    }
  });
}

function skeletonCard(plugin) {
  return `
    <div class="plugin-card-main">
      <div class="plugin-card-icon">${plugin.icon}</div>
      <div class="plugin-meta">${plugin.badges.map(b => `<span class="plugin-badge">${b}</span>`).join('')}</div>
      <div class="skeleton" style="width:60%;height:16px;margin-bottom:10px;"></div>
      <div class="skeleton"></div>
      <div class="skeleton" style="width:85%;"></div>
      <div class="plugin-stats" style="margin-top:1rem;">
        <div class="skeleton" style="width:50px;height:12px;margin:0;"></div>
        <div class="skeleton" style="width:50px;height:12px;margin:0;"></div>
      </div>
      <div class="plugin-card-actions">
        <div class="skeleton" style="width:120px;height:12px;margin:0;"></div>
        <div class="skeleton" style="width:80px;height:28px;margin:0;border-radius:6px;"></div>
      </div>
    </div>
    <div class="plugin-drawer"><div class="plugin-drawer-inner"></div></div>`;
}

async function buildPluginCards() {
  const grid = document.getElementById('plugin-cards-grid');

  const cards = window.PLUGINS.map(plugin => {
    const card = document.createElement('div');
    card.className = 'plugin-card anim-item';
    card.innerHTML = skeletonCard(plugin);
    grid.appendChild(card);
    scrollObserver.observe(card);
    return card;
  });

  const repoData = await Promise.all(
    window.PLUGINS.map(p => ghFetch(`https://api.github.com/repos/${p.repo}`))
  );

  window.PLUGINS.forEach((plugin, i) => {
    const rd      = repoData[i];
    const main    = cards[i].querySelector('.plugin-card-main');
    const name    = rd?.name                ?? plugin.repo.split('/')[1];
    const desc    = rd?.description         ?? (rateLimited ? '⚠ Rate limited — add a token (🔑) to load.' : 'Could not load description.');
    const stars   = rd?.stargazers_count    ?? '—';
    const forks   = rd?.forks_count         ?? '—';
    const repoUrl = rd?.html_url            ?? `https://github.com/${plugin.repo}`;

    const extraBadges = [
      plugin.spigotUrl ? `<span class="plugin-badge spigot-badge">Spigot</span>`       : '',
      plugin.betaRepo  ? `<span class="plugin-badge beta-badge">Beta Available</span>` : '',
    ].join('');

    const spigotArg = plugin.spigotUrl ? `'${plugin.spigotUrl}'` : 'null';
    const betaArg   = plugin.betaRepo  ? `'${plugin.betaRepo}'`  : 'null';

    main.innerHTML = `
      <div class="plugin-card-icon">${plugin.icon}</div>
      <div class="plugin-meta">
        ${plugin.badges.map(b => `<span class="plugin-badge">${b}</span>`).join('')}
        ${extraBadges}
      </div>
      <h3>${name}</h3>
      <p class="plugin-card-desc">${desc}</p>
      <div class="plugin-stats">
        <span class="plugin-stat">⭐ ${stars}</span>
        <span class="plugin-stat">🍴 ${forks}</span>
      </div>
      <div class="plugin-card-actions">
        <a href="${repoUrl}" class="plugin-link" target="_blank">View on GitHub ↗</a>
        <button class="expand-btn"
          onclick="toggleDrawer(this.closest('.plugin-card'),'${plugin.repo}',${spigotArg},${betaArg})">
          Details <span class="earrow">▼</span>
        </button>
      </div>`;
  });

  const ph = document.createElement('div');
  ph.className = 'plugin-placeholder';
  ph.innerHTML = '<span>🔧</span><p>More plugins coming soon.<br>Check back later!</p>';
  grid.appendChild(ph);

  observeAnimItems();
}

function fmtDate(s) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function truncBody(body, max = 380) {
  if (!body) return 'No release notes provided.';
  const c = body.replace(/\r\n/g, '\n').trim();
  return c.length <= max ? c : c.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
}

function buildUpdateLogs() {
  const tabsBar  = document.getElementById('ulog-tabs-bar');
  const panelsEl = document.getElementById('ulog-panels');

  window.PLUGINS.forEach((plugin, i) => {
    const name    = plugin.repo.split('/')[1];
    const panelId = 'ulog-' + name;

    const tab = document.createElement('button');
    tab.className   = 'ulog-tab' + (i === 0 ? ' active' : '');
    tab.textContent = name;
    tab.onclick     = () => switchUlogTab(panelId, tab, plugin);
    tabsBar.appendChild(tab);

    const panel = document.createElement('div');
    panel.className      = 'ulog-panel' + (i === 0 ? ' active' : '');
    panel.id             = panelId;
    panel.dataset.loaded = '0';
    panel.innerHTML      = '<p class="ulog-loading">Loading releases…</p>';
    panelsEl.appendChild(panel);

    if (i === 0) loadUlogPanel(panel, plugin);
  });
}

function switchUlogTab(panelId, btn, plugin) {
  document.querySelectorAll('.ulog-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ulog-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById(panelId);
  panel.classList.add('active');
  if (panel.dataset.loaded === '0') loadUlogPanel(panel, plugin);
}

async function loadUlogPanel(panel, plugin) {
  panel.dataset.loaded = '1';
  const releases = (await fetchReleases(plugin.repo)).slice(0, 5);

  if (rateLimited) {
    panel.innerHTML = `<p class="ulog-empty" style="color:#f7a24f;">
      ⚠ Rate limit hit - add a token (🔑 top-right) to load release logs.</p>`;
    return;
  }

  if (!releases.length) {
    panel.innerHTML = '<p class="ulog-empty">No releases published yet for this plugin.</p>';
    return;
  }

  let html = '<div class="release-list">';
  for (const r of releases) {
    const bodyRaw  = truncBody(r.body);
    const hasMore  = r.body && r.body.trim().length > 380;
    const preBadge = r.prerelease
      ? `<span class="release-tag beta-badge" style="background:rgba(247,162,79,.15);color:#f7a24f;border:1px solid #f7a24f33;">BETA</span>`
      : '';
    html += `
      <div class="release-card anim-item">
        <div class="release-header">
          <span class="release-tag">${esc(r.tag_name)}</span>
          ${preBadge}
          <span class="release-date">${r.published_at ? fmtDate(r.published_at) : ''}</span>
        </div>
        <div class="release-name">${esc(r.name || r.tag_name)}</div>
        <pre class="release-body">${esc(bodyRaw)}</pre>
        <a href="${r.html_url}" class="release-readmore" target="_blank">
          ${hasMore ? 'Read more — press here ↗' : 'View on GitHub Releases ↗'}
        </a>
      </div>`;
  }
  html += '</div>';

  panel.innerHTML = html;
  panel.querySelectorAll('.anim-item').forEach(el => scrollObserver.observe(el));
}

injectTokenBtn();
buildPluginCards();
buildUpdateLogs();