if (window.SHOW_REDACTED) {
  document.getElementById('tab-redacted').style.display = '';
}

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

async function ghFetch(url) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  return r.json();
}

async function fetchConfigYml(repo) {
  for (const path of window.CONFIG_PATHS) {
    const d = await ghFetch(`https://api.github.com/repos/${repo}/contents/${path}`);
    if (d && d.content) return atob(d.content.replace(/\n/g, ''));
  }
  return null;
}

async function fetchLatestRelease(repo) {
  const d = await ghFetch(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!d || !d.assets) return null;
  const jar = d.assets.find(a => a.name.endsWith('.jar'));
  if (!jar) return null;
  return { name: jar.name, url: jar.browser_download_url, version: d.tag_name };
}

async function fetchLatestBeta(repo) {
  if (!repo) return null;
  const releases = await ghFetch(`https://api.github.com/repos/${repo}/releases?per_page=10`);
  if (!Array.isArray(releases)) return null;
  const pre = releases.find(r => r.prerelease);
  if (!pre) return null;
  const jar = pre.assets && pre.assets.find(a => a.name.endsWith('.jar'));
  if (!jar) return null;
  return { name: jar.name, url: jar.browser_download_url, version: pre.tag_name, releaseUrl: pre.html_url };
}

async function fetchReleases(repo, limit = 5) {
  const d = await ghFetch(`https://api.github.com/repos/${repo}/releases?per_page=${limit}`);
  return Array.isArray(d) ? d.slice(0, limit) : [];
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
  if (!val || !val.trim()) return val;
  const ci   = val.search(/ #/);
  let main   = val, com = '';
  if (ci !== -1) {
    main = val.slice(0, ci);
    com  = `<span class="hl-comment">${val.slice(ci)}</span>`;
  }
  const t = main.trim();
  if (/^["']/.test(t))                          return `<span class="hl-string">${main}</span>${com}`;
  if (/^(true|false|yes|no|null|~)$/i.test(t))  return `<span class="hl-bool">${main}</span>${com}`;
  if (/^-?\d+(\.\d+)?$/.test(t))                return `<span class="hl-num">${main}</span>${com}`;
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

  if (isOpen) {
    drawer.classList.remove('open');
    btn.classList.remove('open');
    return;
  }

  drawer.classList.add('open');
  btn.classList.add('open');
  if (drawer.dataset.loaded) return;
  drawer.dataset.loaded = '1';

  const inner = drawer.querySelector('.plugin-drawer-inner');
  inner.innerHTML = '<span class="drawer-loading">Loading data from GitHub…</span>';

  const uid = 'cfg-' + repo.replace(/\//g, '-');

  Promise.all([
    fetchConfigYml(repo),
    fetchLatestRelease(repo),
    fetchLatestBeta(betaRepo || null),
  ]).then(([config, release, beta]) => {
    let html = '';

    html += `<span class="drawer-section-label">config.yml</span>`;
    if (config) {
      const safe = esc(config);
      html += `<span class="config-hint">You can edit this config before downloading</span>`;
      html += `<div class="config-editor-wrap">`;
      html +=   `<pre class="config-highlight" id="pre-${uid}" aria-hidden="true"></pre>`;
      html +=   `<textarea class="config-editor" id="${uid}" spellcheck="false"
                   oninput="syncHighlight('${uid}')"
                   onscroll="syncScroll('${uid}')"
                   onkeydown="handleTab(event)">${safe}</textarea>`;
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

    if (betaRepo !== null && betaRepo !== undefined) {
      html += `<span class="drawer-section-label beta-label" style="margin-top:1.5rem;display:block;">`;
      html +=   `Beta / Pre-release${beta ? ' — ' + beta.version : ''}`;
      html += `</span>`;
      if (beta) {
        html += `<div class="drawer-actions">`;
        html +=   `<a class="download-btn beta-btn" href="${beta.url}" download target="_blank">`;
        html +=     `⚡ Download Beta ${esc(beta.name)}`;
        html +=   `</a>`;
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
      document.getElementById('reset-' + uid).onclick = () => {
        ta.value = orig;
        syncHighlight(uid);
      };
    }
  });
}

async function buildPluginCards() {
  const grid = document.getElementById('plugin-cards-grid');

  for (const plugin of window.PLUGINS) {
    const card = document.createElement('div');
    card.className = 'plugin-card anim-item';

    card.innerHTML = `
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

    grid.appendChild(card);
    scrollObserver.observe(card);

    const rd       = await ghFetch(`https://api.github.com/repos/${plugin.repo}`);
    const main     = card.querySelector('.plugin-card-main');
    const name     = rd ? rd.name                                       : plugin.repo.split('/')[1];
    const desc     = rd ? (rd.description || 'No description provided.') : 'Could not load description.';
    const stars    = rd ? rd.stargazers_count                           : '-';
    const forks    = rd ? rd.forks_count                                : '-';
    const repoUrl  = rd ? rd.html_url                                   : `https://github.com/${plugin.repo}`;

    let extraBadges = '';
    if (plugin.spigotUrl) extraBadges += `<span class="plugin-badge spigot-badge">Spigot</span>`;
    if (plugin.betaRepo)  extraBadges += `<span class="plugin-badge beta-badge">Beta Available</span>`;

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
  }

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
  if (c.length <= max) return c;
  return c.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
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
  const releases = await fetchReleases(plugin.repo, 5);

  if (!releases.length) {
    panel.innerHTML = '<p class="ulog-empty">No releases published yet for this plugin.</p>';
    return;
  }

  let html = '<div class="release-list">';
  for (const r of releases) {
    const bodyRaw = truncBody(r.body);
    const bodyEsc = esc(bodyRaw);
    const hasMore = r.body && r.body.trim().length > 380;
    const date    = r.published_at ? fmtDate(r.published_at) : '';
    const title   = esc(r.name || r.tag_name);
    const tag     = esc(r.tag_name);
    const preBadge = r.prerelease
      ? `<span class="release-tag beta-badge" style="background:rgba(247,162,79,.15);color:#f7a24f;border:1px solid #f7a24f33;">BETA</span>`
      : '';

    html += `
      <div class="release-card anim-item">
        <div class="release-header">
          <span class="release-tag">${tag}</span>
          ${preBadge}
          <span class="release-date">${date}</span>
        </div>
        <div class="release-name">${title}</div>
        <pre class="release-body">${bodyEsc}</pre>
        <a href="${r.html_url}" class="release-readmore" target="_blank">
          ${hasMore ? 'Read more — press here ↗' : 'View on GitHub Releases ↗'}
        </a>
      </div>`;
  }
  html += '</div>';

  panel.innerHTML = html;
  panel.querySelectorAll('.anim-item').forEach(el => scrollObserver.observe(el));
}

buildPluginCards();
buildUpdateLogs();