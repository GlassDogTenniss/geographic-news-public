const map = L.map('map').setView([36.2, 138.2], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png' });

const statusEl = document.getElementById('status');
const topicListEl = document.getElementById('topicList');
const panelToggleEl = document.getElementById('panelToggle');
const panelCloseButtonEl = document.getElementById('panelCloseButton');
const panelScrollEl = document.querySelector('.panel-scroll');
const updatedAtBadgeEl = document.getElementById('updatedAtBadge');
const markers = [];
const topicItems = [];
let activeTopicItem = null;
let countryIndicatorEl = null;
let scrollFrame = null;

function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function originalTitleBlock(p) { return p.original_title ? `<br><small>原題: ${esc(p.original_title)}</small>` : ''; }
function displayPlace(p) { return p.place_label || p.representative_place || p.geocode_query || ''; }
function popup(p) { const link = esc(p.link); return `<strong>${esc(p.title)}</strong>${originalTitleBlock(p)}<br><span>${esc(displayPlace(p))}</span><br><small>${esc(p.place_type)}</small><br><p>${esc(p.place_reason)}</p>${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${esc(p.source) || 'source'}</a>` : ''}`; }
function getFeaturePlace(feature) { const p = feature.properties || {}; return p.sort_place_label || p.place_label || p.representative_place || p.geocode_query || ''; }
function getFeaturePublishedAt(feature) { const p = feature.properties || {}; const time = Date.parse(p.published_at || ''); return Number.isNaN(time) ? 0 : time; }
function sortedFeaturesByPlace(features) { return [...features].sort((a, b) => { const ap = getFeaturePlace(a); const bp = getFeaturePlace(b); const placeOrder = ap.localeCompare(bp, 'ja-JP', { numeric: true, sensitivity: 'base' }); if (placeOrder !== 0) return placeOrder; const at = getFeaturePublishedAt(a); const bt = getFeaturePublishedAt(b); if (at !== bt) return bt - at; const aTitle = (a.properties && a.properties.title) || ''; const bTitle = (b.properties && b.properties.title) || ''; return aTitle.localeCompare(bTitle, 'ja-JP', { numeric: true, sensitivity: 'base' }); }); }
function getFeatureCountry(feature) { const p = feature.properties || {}; return countryFromPlaceLabel(p.sort_place_label || p.place_label || p.representative_place || p.geocode_query || ''); }
function countryFromPlaceLabel(label) { const text = String(label || '').trim(); if (!text) return '国不明'; if (text.startsWith('日本-')) return '日本'; if (/^(北海道|東京都|京都府|大阪府|.{2,3}県)(-|$)/.test(text)) return '日本'; const first = text.split(/[-・/]/).map(part => part.trim()).find(Boolean); return first || '国不明'; }
function countryColors(country) { let hash = 0; for (const char of country) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0; const hue = hash % 360; return { bg: `hsl(${hue} 70% 97%)`, border: `hsl(${hue} 45% 78%)`, header: `hsl(${hue} 70% 95%)` }; }
function applyCountryStyle(el, country) { const colors = countryColors(country); el.style.setProperty('--country-bg', colors.bg); el.style.setProperty('--country-border', colors.border); el.style.setProperty('--country-header-bg', colors.header); }
function ensureCountryIndicator() { if (countryIndicatorEl) return countryIndicatorEl; countryIndicatorEl = document.createElement('div'); countryIndicatorEl.className = 'country-indicator'; countryIndicatorEl.textContent = '表示中の国: -'; return countryIndicatorEl; }
function updateCountryIndicator(country) { const indicator = ensureCountryIndicator(); indicator.textContent = `表示中の国: ${country || '-'}`; applyCountryStyle(indicator, country || '国不明'); }
function firstVisibleTopicItem() { if (!panelScrollEl || !topicItems.length) return null; const top = panelScrollEl.getBoundingClientRect().top; return topicItems.find(item => item.getBoundingClientRect().bottom > top + 6) || topicItems[0]; }
function updateVisibleCountry() { const item = firstVisibleTopicItem(); if (item) updateCountryIndicator(item.dataset.country || '国不明'); }
function scheduleVisibleCountryUpdate() { if (scrollFrame) cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(() => { scrollFrame = null; updateVisibleCountry(); }); }
function isPanelCollapsed() { return document.body.classList.contains('panel-collapsed'); }
function scrollActiveTopicItem(behavior = 'smooth') { if (!activeTopicItem || isPanelCollapsed()) return; activeTopicItem.scrollIntoView({ block: 'center', behavior }); }
function setActiveTopicItem(item, options = {}) { const shouldScroll = options.scroll !== false; if (activeTopicItem) activeTopicItem.classList.remove('active'); activeTopicItem = item; activeTopicItem.classList.add('active'); updateCountryIndicator(item.dataset.country || '国不明'); if (shouldScroll) scrollActiveTopicItem(); }
function addList(feature, marker) { const p = feature.properties || {}; const country = getFeatureCountry(feature); const item = document.createElement('div'); item.className = 'topic-item country-coded'; item.dataset.country = country; applyCountryStyle(item, country); const original = p.original_title ? `<div class="topic-meta">原題: ${esc(p.original_title)}</div>` : ''; item.innerHTML = `<div class="topic-title">${esc(p.title)}</div>${original}<div class="topic-meta">${esc(displayPlace(p))} / ${esc(p.place_type)}</div>`; item.addEventListener('click', () => { setActiveTopicItem(item); map.panTo(marker.getLatLng()); marker.openPopup(); }); marker.on('click', () => setActiveTopicItem(item, { scroll: !isPanelCollapsed() })); topicItems.push(item); topicListEl.appendChild(item); }
function formatUpdatedAt(value) { if (!value) return '更新日不明'; const date = new Date(value); if (Number.isNaN(date.getTime())) return `更新: ${value}`; return `更新: ${date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`; }
function setUpdatedAt(createdAt) { const label = formatUpdatedAt(createdAt); statusEl.textContent = label; updatedAtBadgeEl.textContent = label; updatedAtBadgeEl.title = createdAt || ''; }
function addStats(stats, createdAt) { const block = document.createElement('div'); block.className = 'stats'; block.innerHTML = `<div class="stat"><span class="stat-value">${esc(stats.collected ?? '-')}</span><span class="stat-label">取得</span></div><div class="stat"><span class="stat-value">${esc(stats.topics ?? '-')}</span><span class="stat-label">表示</span></div><div class="stat"><span class="stat-value">${esc(stats.unresolved ?? '-')}</span><span class="stat-label">未解決</span></div>`; statusEl.after(block); block.after(ensureCountryIndicator()); setUpdatedAt(createdAt); updateVisibleCountry(); }
function addUnresolvedList(items) { if (!items.length) return; const title = document.createElement('div'); title.className = 'section-title'; title.textContent = `未解決ニュース ${items.length}件`; topicListEl.after(title); const list = document.createElement('div'); list.className = 'unresolved-list'; items.slice(0, 20).forEach(item => { const div = document.createElement('div'); div.className = 'unresolved-item'; const link = esc(item.link); const original = item.original_title ? `<div class="topic-meta">原題: ${esc(item.original_title)}</div>` : ''; div.innerHTML = `<div class="topic-title">${esc(item.title)}</div>${original}<div class="topic-meta">${esc(item.source)}${link ? ` / <a href="${link}" target="_blank" rel="noopener noreferrer">source</a>` : ''}</div>`; list.appendChild(div); }); title.after(list); }
function updatePanelControls(collapsed) { panelToggleEl.textContent = collapsed ? '一覧を開く' : '一覧を閉じる'; panelToggleEl.setAttribute('aria-expanded', String(!collapsed)); if (panelCloseButtonEl) panelCloseButtonEl.hidden = collapsed; }
function setPanelCollapsed(collapsed) { document.body.classList.toggle('panel-collapsed', collapsed); updatePanelControls(collapsed); setTimeout(() => { map.invalidateSize(); if (!collapsed) { scrollActiveTopicItem(); scheduleVisibleCountryUpdate(); } }, 160); }

panelToggleEl.addEventListener('click', () => setPanelCollapsed(!document.body.classList.contains('panel-collapsed')));
if (panelCloseButtonEl) panelCloseButtonEl.addEventListener('click', () => setPanelCollapsed(true));
if (panelScrollEl) panelScrollEl.addEventListener('scroll', scheduleVisibleCountryUpdate, { passive: true });
if (window.innerWidth <= 700) setPanelCollapsed(true); else updatePanelControls(false);

Promise.all([
  fetch('./latest.geojson', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
  fetch('./latest-unresolved.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : { unresolved: [] })
]).then(([geojson, unresolvedJson]) => {
  const features = sortedFeaturesByPlace(geojson.features || []);
  features.forEach(feature => {
    const c = feature.geometry && feature.geometry.coordinates;
    if (!c || c.length < 2) return;
    const marker = L.marker([c[1], c[0]]).addTo(map);
    marker.bindPopup(popup(feature.properties || {}));
    markers.push(marker);
    addList(feature, marker);
  });
  if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25));
  const stats = (geojson.properties && geojson.properties.stats) || { topics: markers.length, unresolved: (unresolvedJson.unresolved || []).length };
  addStats(stats, geojson.properties && geojson.properties.created_at);
  addUnresolvedList(unresolvedJson.unresolved || []);
}).catch(e => { console.error(e); statusEl.textContent = 'ニュース地図データの読み込みに失敗しました。'; updatedAtBadgeEl.textContent = '更新日取得失敗'; });
