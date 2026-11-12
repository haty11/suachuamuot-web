/* Mướt Mườn Mượt · Google Maps dùng chung (web bán hàng + trang quản lý)
 * Mã API lấy từ Sheet › Cài đặt › "Mã Google Maps (API key)" qua Apps Script, không nằm trong code.
 * Dùng: Places API (New) gợi ý địa chỉ · Routes API km đường xe máy · Maps Embed API bản đồ (miễn phí).
 *   MMMMaps.init(API_URL) → Promise<cfg|null>   (null = chưa có mã → trang dùng cách nhập tay)
 *   MMMMaps.suggest('48 Tố Hữu') → [{main, sub, text, km}]
 *   MMMMaps.pick(item) → {addr, full, ward, ll:{lat,lng}, km, phut, road}
 *   MMMMaps.embed(ll) → URL iframe bản đồ đường đi · MMMMaps.link(dest) → link mở Google Maps
 */
window.MMMMaps = (function () {
  var cfg = null, ready = null, lib = null, tok = null, SK = 'mmm-maps-cfg';
  function hav(a, b) { var R = 6371, r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2), y = Math.sin((b.lng - a.lng) * r / 2); return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a.lat * r) * Math.cos(b.lat * r) * y * y)); }
  function loadJs(key) {
    return new Promise(function (res, rej) {
      if (window.google && google.maps && google.maps.importLibrary) return res();
      window.__mmmMapsCb = function () { res(); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly&loading=async&language=vi&region=VN&callback=__mmmMapsCb';
      s.async = true; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function init(api) {
    if (ready) return ready;
    ready = (async function () {
      var c = null;
      try { c = JSON.parse(sessionStorage.getItem(SK) || 'null'); } catch (e) {}
      if (!c) { c = await fetch(api + '?action=mapcfg').then(function (r) { return r.json(); }); if (c && c.key) try { sessionStorage.setItem(SK, JSON.stringify(c)); } catch (e) {} }
      if (!c || !c.key) return null;
      cfg = c; await loadJs(c.key);
      lib = await google.maps.importLibrary('places');
      return cfg;
    })().catch(function (e) { console.warn('[Maps]', e); ready = null; return null; });
    return ready;
  }
  async function suggest(q) {
    if (!lib || !q || q.trim().length < 3) return [];
    tok = tok || new lib.AutocompleteSessionToken();
    var shop = { lat: cfg.lat, lng: cfg.lng };
    var r = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q, sessionToken: tok, includedRegionCodes: ['vn'], language: 'vi', region: 'vn', locationBias: { center: shop, radius: 20000 }, origin: shop });
    return (r.suggestions || []).filter(function (s) { return s.placePrediction; }).slice(0, 6).map(function (s) {
      var p = s.placePrediction;
      return { main: p.mainText ? p.mainText.text : p.text.text, sub: p.secondaryText ? p.secondaryText.text : '', text: p.text.text, km: p.distanceMeters != null ? Math.round(p.distanceMeters / 100) / 10 : null, _p: p };
    });
  }
  async function route(ll) {
    var body = function (mode) { return JSON.stringify({ origin: { location: { latLng: { latitude: cfg.lat, longitude: cfg.lng } } }, destination: { location: { latLng: { latitude: ll.lat, longitude: ll.lng } } }, travelMode: mode, languageCode: 'vi', regionCode: 'VN' }); };
    for (var mode of ['TWO_WHEELER', 'DRIVE']) {
      try {
        var j = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': cfg.key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' }, body: body(mode) }).then(function (r) { return r.json(); });
        var rt = j.routes && j.routes[0];
        if (rt && rt.distanceMeters) return { road: true, km: Math.round(rt.distanceMeters / 100) / 10, phut: Math.max(1, Math.round(parseInt(rt.duration, 10) / 60)) };
      } catch (e) {}
    }
    return { road: false, km: Math.round(hav(cfg, ll) * 1.3 * 10) / 10, phut: null };
  }
  async function pick(item) {
    var place = item._p.toPlace();
    await place.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents'] });
    tok = null;
    var ll = { lat: place.location.lat(), lng: place.location.lng() }, ward = '';
    (place.addressComponents || []).forEach(function (c) {
      if (!ward && /sublocality_level_1|administrative_area_level_3|sublocality|neighborhood/.test((c.types || []).join(' '))) ward = c.longText;
    });
    var r = await route(ll);
    return { addr: item.text || place.formattedAddress, full: place.formattedAddress, ward: ward, ll: ll, km: r.km, phut: r.phut, road: r.road };
  }
  function embed(ll) { return 'https://www.google.com/maps/embed/v1/directions?key=' + encodeURIComponent(cfg.key) + '&origin=' + cfg.lat + ',' + cfg.lng + '&destination=' + ll.lat + ',' + ll.lng + '&mode=driving&language=vi'; }
  function link(dest) { return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent((cfg && cfg.addr) || '12 Nguyên Hồng, Giảng Võ, Hà Nội') + '&destination=' + encodeURIComponent(dest.lat != null ? dest.lat + ',' + dest.lng : dest) + '&travelmode=two-wheeler'; }
  return { init: init, suggest: suggest, pick: pick, route: route, embed: embed, link: link, on: function () { return !!lib; }, cfg: function () { return cfg; } };
})();
