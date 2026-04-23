const REPO_RAW_BASE =
  'https://raw.githubusercontent.com/If-Master/If-Master.github.io/main/';

const TRACKED_FILES = [
  'app.js',
  'plugins.js',
  'index.html',
  'styles.css',
  'README.md',
];

const CACHE_PREFIX   = 'ghcache__';
const META_KEY       = 'ghcache__meta';
const ONE_DAY_MS     = 24 * 60 * 60 * 1000;

class GitHubCache {
  constructor(trackedFiles = TRACKED_FILES) {
    this.trackedFiles = trackedFiles;
  }


  async get(filename) {
    await this._refreshIfStale();
    return localStorage.getItem(CACHE_PREFIX + filename) ?? null;
  }

  async forceRefresh() {
    await this._fetchAndStore();
  }

  getMeta() {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  
  msUntilNextRefresh() {
    const meta = this.getMeta();
    if (!meta) return 0;
    const elapsed = Date.now() - meta.lastFetch;
    return Math.max(0, ONE_DAY_MS - elapsed);
  }


  async _refreshIfStale() {
    const meta = this.getMeta();
    const isStale =
      !meta || Date.now() - meta.lastFetch > ONE_DAY_MS;

    if (isStale) {
      console.log('[GitHubCache] Cache stale or empty — pulling from GitHub…');
      await this._fetchAndStore();
    } else {
      const mins = Math.round(this.msUntilNextRefresh() / 60_000);
      console.log(`[GitHubCache] Cache is fresh. Next refresh in ~${mins} min.`);
    }
  }

  async _fetchAndStore() {
    const meta = this.getMeta() ?? { lastFetch: 0, files: {} };
    const results = {};

    await Promise.all(
      this.trackedFiles.map(async (file) => {
        try {
          const apiUrl = `https://api.github.com/repos/If-Master/If-Master.github.io/contents/${file}`;
          const res = await fetch(apiUrl, {
            headers: { Accept: 'application/vnd.github.v3+json' },
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const json = await res.json();
          const newSha = json.sha;

          if (newSha !== meta.files?.[file]) {
            const content = atob(json.content.replace(/\n/g, ''));
            localStorage.setItem(CACHE_PREFIX + file, content);
            console.log(`[GitHubCache] Updated: ${file} (sha: ${newSha.slice(0, 7)})`);
          } else {
            console.log(`[GitHubCache] No change: ${file}`);
          }

          results[file] = newSha;
        } catch (err) {
          console.warn(`[GitHubCache] Failed to fetch ${file}:`, err.message);
          results[file] = meta.files?.[file] ?? null;
        }
      })
    );

    const updatedMeta = {
      lastFetch: Date.now(),
      files: results,
    };
    localStorage.setItem(META_KEY, JSON.stringify(updatedMeta));
    console.log('[GitHubCache] Refresh complete:', new Date().toLocaleString());
  }
}

export default GitHubCache;