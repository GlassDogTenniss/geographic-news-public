const map = L.map('map').setView([36.2, 138.2], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, opacity: 0.23, attribution: 'Terrain overlay: &copy; OpenTopoMap (CC-BY-SA)' }).addTo(map);
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
function displayPlace(p) { return p.place_label || p.representative_place || p.geocode_query || ''; }
function originalTitleBlock(p) { return p.original_title ? `<br><small>原題: ${esc(p.original_title)}</small>` : ''; }
function popup(p) { const link = esc(p.link); return `<strong>${esc(p.title)}</strong>${originalTitleBlock(p)}<br><span>${esc(displayPlace(p))}</span><br><small>${esc(p.place_type)}</small><br><p>${esc(p.place_reason)}</p>${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${esc(p.source) || 'source'}</a>` : ''}`; }
function isKunlunPlaceholder(feature) { return (feature.properties || {}).rule_id === 'unresolved_kunlun_placeholder'; }
function getFeaturePlace(feature) { const p = feature.properties || {}; return p.sort_place_label || p.place_label || p.representative_place || p.geocode_query || ''; }
function getFeaturePublishedAt(feature) { const p = feature.properties || {}; const time = Date.parse(p.published_at || ''); return Number.isNaN(time) ? 0 : time; }
function sortedFeaturesByPlace(features) { return [...features].sort((a, b) => { const ak = isKunlunPlaceholder(a); const bk = isKunlunPlaceholder(b); if (ak !== bk) return ak ? 1 : -1; const placeOrder = getFeaturePlace(a).localeCompare(getFeaturePlace(b), 'ja-JP', { numeric: true, sensitivity: 'base' }); if (placeOrder) return placeOrder; return getFeaturePublishedAt(b) - getFeaturePublishedAt(a); }); }
function countryFromPlaceLabel(label) { const text = String(label || '').trim(); if (!text) return '国不明'; if (text.startsWith('日本-')) return '日本'; if (/^(北海道|東京都|京都府|大阪府|.{2,3}県)(-|$)/.test(text)) return '日本'; return text.split(/[-・/]/).map(part => part.trim()).find(Boolean) || '国不明'; }
function getFeatureCountry(feature) { const p = feature.properties || {}; return countryFromPlaceLabel(p.place_label || p.representative_place || p.geocode_query || p.sort_place_label || ''); }
function countryColors(country) { let hash = 0; for (const char of country) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0; const hue = hash % 360; return { bg: `hsl(${hue} 70% 97%)`, border: `hsl(${hue} 45% 78%)`, header: `hsl(${hue} 70% 95%)` }; }
function applyCountryStyle(el, country) { const colors = countryColors(country); el.style.setProperty('--country-bg', colors.bg); el.style.setProperty('--country-border', colors.border); el.style.setProperty('--country-header-bg', colors.header); }
function ensureCountryIndicator() { if (countryIndicatorEl) return countryIndicatorEl; countryIndicatorEl = document.createElement('div'); countryIndicatorEl.className = 'country-indicator'; countryIndicatorEl.textContent = '表示中の国: -'; return countryIndicatorEl; }
function updateCountryIndicator(country) { const indicator = ensureCountryIndicator(); indicator.textContent = `表示中の国: ${country || '-'}`; applyCountryStyle(indicator, country || '国不明'); }
function firstVisibleTopicItem() { if (!panelScrollEl || !topicItems.length) return null; const top = panelScrollEl.getBoundingClientRect().top; return topicItems.find(item => item.getBoundingClientRect().bottom > top + 6) || topicItems[0]; }
function updateVisibleCountry() { const item = firstVisibleTopicItem(); if (item) updateCountryIndicator(item.dataset.country || '国不明'); }
function scheduleVisibleCountryUpdate() { if (scrollFrame) cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(() => { scrollFrame = null; updateVisibleCountry(); }); }
function isPanelCollapsed() { return document.body.classList.contains('panel-collapsed'); }
function scrollActiveTopicItem(behavior = 'smooth') { if (!activeTopicItem || isPanelCollapsed()) return; activeTopicItem.scrollIntoView({ block: 'start', behavior }); }
function setActiveTopicItem(item, options = {}) { const shouldScroll = options.scroll !== false; if (activeTopicItem) activeTopicItem.classList.remove('active'); activeTopicItem = item; activeTopicItem.classList.add('active'); updateCountryIndicator(item.dataset.country || '国不明'); if (shouldScroll) scrollActiveTopicItem(); }
function addList(feature, marker) { const p = feature.properties || {}; const country = getFeatureCountry(feature); const item = document.createElement('div'); item.className = 'topic-item country-coded'; item.dataset.country = country; applyCountryStyle(item, country); const original = p.original_title ? `<div class="topic-meta">原題: ${esc(p.original_title)}</div>` : ''; item.innerHTML = `<div class="topic-title">${esc(p.title)}</div>${original}<div class="topic-meta">${esc(displayPlace(p))} / ${esc(p.place_type)}</div>`; item.addEventListener('click', () => { setActiveTopicItem(item); map.panTo(marker.getLatLng()); marker.openPopup(); }); marker.on('click', () => setActiveTopicItem(item, { scroll: !isPanelCollapsed() })); topicItems.push(item); topicListEl.appendChild(item); }
function kunlunFeature(item) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [90.0, 35.0] }, properties: { title: item.title || '', original_title: item.original_title, source: item.source || '', link: item.link || '', published_at: item.published_at || null, representative_place: '場所不明(崑崙山)', place_label: '場所不明(崑崙山)', sort_place_label: '場所不明(崑崙山)', geocode_query: 'Kunlun Mountains, China', place_type: 'unresolved_placeholder', location_precision: 'placeholder', place_reason: '場所を特定できなかったため、未解決ニュースの仮置き地点として崑崙山に置いています。', confidence: 0, rule_id: 'unresolved_kunlun_placeholder' } }; }
function kunlunFeatures(items) { return (items || []).filter(item => item && item.title).map(kunlunFeature); }
function formatUpdatedAt(value) { if (!value) return '更新日不明'; const date = new Date(value); if (Number.isNaN(date.getTime())) return `更新: ${value}`; return `更新: ${date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`; }
function setUpdatedAt(createdAt) { const label = formatUpdatedAt(createdAt); statusEl.textContent = label; updatedAtBadgeEl.textContent = label; updatedAtBadgeEl.title = createdAt || ''; }
function addStats(stats, createdAt) { const block = document.createElement('div'); block.className = 'stats'; block.innerHTML = `<div class="stat"><span class="stat-value">${esc(stats.collected ?? '-')}</span><span class="stat-label">取得</span></div><div class="stat"><span class="stat-value">${esc(stats.topics ?? '-')}</span><span class="stat-label">表示</span></div><div class="stat"><span class="stat-value">${esc(stats.unresolved ?? '-')}</span><span class="stat-label">場所不明</span></div>`; statusEl.after(block); block.after(ensureCountryIndicator()); setUpdatedAt(createdAt); updateVisibleCountry(); }
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
  const unresolvedFeatures = kunlunFeatures(unresolvedJson.unresolved || []);
  const features = sortedFeaturesByPlace([...(geojson.features || []), ...unresolvedFeatures]);
  features.forEach(feature => {
    const c = feature.geometry && feature.geometry.coordinates;
    if (!c || c.length < 2) return;
    const marker = L.marker([c[1], c[0]]).addTo(map);
    marker.bindPopup(popup(feature.properties || {}));
    markers.push(marker);
    addList(feature, marker);
  });
  if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25));
  const baseStats = (geojson.properties && geojson.properties.stats) || {};
  const stats = { ...baseStats, topics: features.length, unresolved: unresolvedFeatures.length };
  addStats(stats, geojson.properties && geojson.properties.created_at);
}).catch(e => { console.error(e); statusEl.textContent = 'ニュース地図データの読み込みに失敗しました。'; updatedAtBadgeEl.textContent = '更新日取得失敗'; });
