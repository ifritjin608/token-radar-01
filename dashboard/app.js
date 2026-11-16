// Token Radar dashboard: board, detail view, filters. No network: all data is window.RADAR.
(function () {
  var D = window.RADAR;
  if (!D) { document.getElementById('meta').textContent = 'No data found.'; return; }
  var $ = function (id) { return document.getElementById(id); };
  var rows = D.rows, live = D.live;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(v) {
    if (v == null) return '—';
    var c = v > 0 ? 'up' : v < 0 ? 'down' : '';
    return '<span class="' + c + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>';
  }
  function age(a) { return a == null ? '—' : a >= 365 ? (a / 365).toFixed(1) + 'y' : a + 'd'; }

  $('meta').textContent = D.board_size + ' pre-token protocols ranked · watchlist ' + D.watchlist_size +
    ' · ' + D.early_size + ' early rows below the $50M floor · snapshot ' + D.as_of + ' · model ' + D.model_version;
  $('src').textContent = 'Source: ' + D.source + '. Snapshot frozen 14 Nov 2026; the board never refetches it.';

  // Filter options from the data itself.
  var cats = {}, chains = {};
  rows.forEach(function (r) { if (r.category) cats[r.category] = 1; r.chains.forEach(function (c) { chains[c] = 1; }); });
  Object.keys(cats).sort().forEach(function (c) { $('cat').add(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('chain').add(new Option(c, c)); });

  var state = { q: '', cat: '', chain: '', watch: false, sort: 'value', view: 'board', sel: null };

  function filtered() {
    var q = state.q.toLowerCase();
    var out = rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return out;
  }
  function sorted(list) {
    var k = state.sort, copy = list.slice();
    if (k === 'value') copy.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; });
    if (k === 'tvl') copy.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    if (k === 'growth') copy.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); });
    if (k === 'age') copy.sort(function (a, b) { return (b.age_days || 0) - (a.age_days || 0); });
    return copy;
  }
  function watchOnly(list) {
    if (!state.watch) return list;
    var wl = {};
    D.watchlist.forEach(function (s) { wl[s] = 1; });
    return list.filter(function (r) { return wl[r.slug]; });
  }

  function renderBoard() {
    var list = watchOnly(sorted(filtered()));
    $('count').textContent = list.length + ' of ' + rows.length + ' rows shown';
    $('rows').innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td><td><b>' + esc(r.name) + '</b><br><span class="meta">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td><td class="num val">' + money(r.implied_value_usd) + '</td></tr>';
    }).join('');
  }

  function renderLive() {
    $('live-rows').innerHTML = live.map(function (r) {
      return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.category || '—') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td></tr>';
    }).join('');
  }

  function renderDetail() {
    var box = $('detail');
    var r = null;
    rows.forEach(function (x) { if (x.slug === state.sel) r = x; });
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    var base = r.tvl_usd * D.model.base_multiple;
    var steps = (r.farm_steps || []).map(function (s, i) {
      var m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(m[1]) + ' <span class="meta">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
    }).join('');
    box.innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorized') + ' · ' + r.chains.map(esc).join(', ') +
      ' · TVL ' + money(r.tvl_usd) + ' · 7d ' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') +
      ' · listed ' + (r.listed_at || 'unknown') + ' · records no token in the snapshot</p>' +
      '<div class="math"><span>Base TVL × 0.25 = <b>' + money(base) + '</b></span>' +
      '<span>Growth ×<b>' + r.growth_multiplier.toFixed(2) + '</b></span>' +
      '<span>Maturity ×<b>' + r.maturity_multiplier.toFixed(2) + '</b></span>' +
      '<span>Breadth ×<b>' + r.breadth_multiplier.toFixed(2) + '</b></span>' +
      '<span>Implied value = <b>' + money(r.implied_value_usd) + '</b></span></div>' +
      '<h3>How to farm it</h3><ol>' + steps + '</ol>';
    box.hidden = false;
    box.scrollIntoView({ block: 'nearest' });
  }

  function render() { renderBoard(); renderDetail(); }

  function setView(v) {
    state.view = v;
    $('view-board').classList.toggle('on', v === 'board');
    $('view-live').classList.toggle('on', v === 'live');
    $('board-view').hidden = v !== 'board';
    $('live-view').hidden = v !== 'live';
    $('count').style.display = v === 'board' ? '' : 'none';
    if (v === 'live') renderLive();
  }

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('watch').addEventListener('change', function (e) { state.watch = e.target.checked; renderBoard(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
  $('view-board').addEventListener('click', function () { setView('board'); });
  $('view-live').addEventListener('click', function () { setView('live'); });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (!tr) return;
    state.sel = state.sel === tr.getAttribute('data-slug') ? null : tr.getAttribute('data-slug');
    render();
  });
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (k === 'implied_value_usd') state.sort = 'value';
      else if (k === 'tvl_usd') state.sort = 'tvl';
      else if (k === 'change_7d') state.sort = 'growth';
      else if (k === 'age_days') state.sort = 'age';
      else return;
      $('sort').value = state.sort;
      renderBoard();
    });
  });

  // Deep links for the three screenshots: #detail=<slug>, #filter=category:<name> or chain:<name>.
  function fromHash() {
    var h = location.hash.slice(1);
    var m = h.match(/detail=([^&]+)/);
    if (m) state.sel = decodeURIComponent(m[1]);
    m = h.match(/filter=category:([^&]+)/);
    if (m) { state.cat = decodeURIComponent(m[1]); $('cat').value = state.cat; }
    m = h.match(/filter=chain:([^&]+)/);
    if (m) { state.chain = decodeURIComponent(m[1]); $('chain').value = state.chain; }
  }
  fromHash();
  render();
})();
