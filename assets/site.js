/* Mướt Mườn Mượt · suachuamuot.com — dữ liệu sống từ Google Sheet, giỏ hàng, đặt hàng, VietQR */
(function () {
  'use strict';
  var API = (window.MMM_CONFIG || {}).api || '';
  var D = window.MMM_D;                     // dữ liệu mặc định lúc dựng trang (thay ngay bằng dữ liệu Sheet)
  var GEO = window.MMM_GEO || { WARDS: [], STREETS: [], ALIASES: [] };
  var PAGE = document.body.dataset.page || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var FL = {
    'Original không đường': { slug: 'khong-duong', ngan: 'Không đường', bg: '#FFFFFF', ingr: 'không thêm đường', ngot: 'Không thêm đường' },
    'Original ít đường': { slug: 'it-duong', ngan: 'Ít đường', bg: '#F4E8DA', ingr: 'một chút đường', ngot: 'Ít đường' },
    'Trà Earl Grey': { slug: 'earl-grey', ngan: 'Trà Earl Grey', full: 'Trà Earl Grey Anh Quốc', bg: '#E4DEEA', ingr: 'trà Earl Grey Anh Quốc' },
    'Mè đen': { slug: 'me-den', ngan: 'Mè đen', bg: '#E4E0DC', ingr: 'bơ mè đen' },
    'Nhãn sấy': { slug: 'nhan-say', ngan: 'Nhãn sấy', bg: '#EEDDC0', ingr: 'nhãn sấy' },
    'Dâu sấy': { slug: 'dau-say', ngan: 'Dâu sấy', bg: '#F5D3D8', ingr: 'dâu sấy' }
  };
  function slugify(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fl(ten) { return FL[ten] || { slug: slugify(ten), ngan: ten, bg: '#F4E8DA', ingr: ten.toLowerCase() }; }
  function img(ten) { var f = FL[ten]; return f ? '/img/' + f.slug + '.webp' : '/logo.webp'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
  function k(n) { return Math.round(n / 1000) + 'k'; }
  function ls(key, v) { try { if (v === undefined) { var x = localStorage.getItem(key); return x ? JSON.parse(x) : null; } if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) { return null; } }
  function set(sel, v, root) { $$('[data-o="' + sel + '"]', root).forEach(function (e) { e.textContent = v; }); }
  function track(ev, p) { try { if (window.gtag) gtag('event', ev, p || {}); } catch (e) {} }
  function toast(msg, sk) {
    var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = (sk ? '<img class="stk" src="/img/stk/' + sk + '.webp" alt="" width="40" height="40">' : '') + '<span></span>'; t.lastChild.textContent = msg; t.style.opacity = '1'; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = '0'; }, 2400);
  }

  /* ---------- giá ---------- */
  var COTS = ['Thanh trùng', 'A2'], SIZES = [100, 250, 450];
  function viOf(ten) { return D.vi.filter(function (v) { return v.ten === ten; })[0]; }
  function isMix(ten) { var v = viOf(ten); return !v || v.nhom !== 'Original'; }
  function unit(ten, cot, size) { return ((D.gia[cot] || {})[size] || 0) + (isMix(ten) ? D.mix : 0); }
  function cbKey(t) { t = String(t || '').toLowerCase(); return /thử/.test(t) ? 'thu' : /đủ/.test(t) ? 'du' : /kho[eẻ]|khỏe/.test(t) ? 'khoe' : t; }
  function cb(ten) { return D.combos.filter(function (c) { return cbKey(c.ten) === cbKey(ten); })[0] || {}; }
  function vis() { return D.vi.filter(function (v) { return v.ban; }); }
  /** giá 1 món trong giỏ: {le (tổng giá lẻ), gia (thực trả), free} */
  function priceItem(it) {
    var le = 0, gia, c;
    if (it.t !== 'combo') { le = unit(it.vi, it.cot, it.size); return { le: le * it.sl, gia: le * it.sl, free: false }; }
    c = cb(it.combo);
    if (/thử/i.test(it.combo)) { (it.vis || []).forEach(function (v) { le += unit(v, it.cot, 100); }); gia = it.cot === 'A2' ? c.giaA2 : c.giaTT; }
    else if (/đủ/i.test(it.combo)) { vis().forEach(function (v) { le += unit(v.ten, it.cot, 100); }); gia = it.cot === 'A2' ? c.giaA2 : c.giaTT; }
    else { (it.hu || []).forEach(function (h) { le += unit(h.vi, h.cot, h.size); }); gia = le - (c.giam || 0); }
    return { le: le * it.sl, gia: Math.min(le, gia) * it.sl, free: !!c.freeship };
  }

  /* ---------- giỏ hàng ---------- */
  function cart() { return ls('mmm-cart') || []; }
  function saveCart(c) { ls('mmm-cart', c); badge(); }
  function key(it) { return JSON.stringify([it.t, it.vi, it.cot, it.size, it.note || '', it.combo, it.vis, it.hu]); }
  function addCart(it) {
    var c = cart(), same = c.filter(function (x) { return key(x) === key(it); })[0];
    if (same) same.sl += it.sl; else c.push(it);
    saveCart(c);
    var p = priceItem(it); track('add_to_cart', { currency: 'VND', value: p.gia, items: [{ item_name: it.vi || it.combo, quantity: it.sl }] });
  }
  function totals(c) {
    var t = { le: 0, hang: 0, free: false, hu: 0 };
    (c || cart()).forEach(function (it) { var p = priceItem(it); t.le += p.le; t.hang += p.gia; t.free = t.free || p.free; t.hu += it.t === 'combo' ? it.sl * (/đủ/i.test(it.combo) ? vis().length : /thử/i.test(it.combo) ? 3 : 2) : it.sl; });
    t.giam = t.le - t.hang; return t;
  }
  function badge() { var n = totals().hu; $$('[data-o="cartn"]').forEach(function (e) { e.textContent = n; }); }
  function itemTitle(it) {
    if (it.t !== 'combo') return fl(it.vi).ngan;
    return 'Combo ' + it.combo;
  }
  function itemMeta(it) {
    if (it.t !== 'combo') return it.cot + ' · ' + it.size + 'g · ' + fmt(unit(it.vi, it.cot, it.size)) + '/hũ';
    if (/đủ/i.test(it.combo)) return it.cot + ' · 6 hũ 100g, đủ 6 vị';
    if (/thử/i.test(it.combo)) return it.cot + ' · 100g: ' + (it.vis || []).map(function (v) { return fl(v).ngan; }).join(', ');
    return (it.hu || []).map(function (h) { return h.size + 'g ' + fl(h.vi).ngan + ' (' + h.cot.toLowerCase() + ')'; }).join(' + ');
  }
  function itemImg(it) { return img(it.vi || (it.vis && it.vis[0]) || (it.hu && it.hu[0].vi) || 'Original ít đường'); }

  /* ---------- tải dữ liệu Sheet ---------- */
  var applyFns = [];
  function onData(fn) { applyFns.push(fn); fn(); }
  function apply() { applyFns.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); badge(); }
  (function loadLive() {
    var c = ls('mmm-data');
    if (c && c.d && Date.now() - c.t < 6 * 3600e3) D = c.d;
    if (!API) return;
    if (c && Date.now() - c.t < 120e3) return;
    fetch(API + '?action=data').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) return; delete j.ok; delete j.now; D = j; ls('mmm-data', { t: Date.now(), d: j }); apply(); analytics();
    }).catch(function () {});
  })();

  /* ---------- đo lường (GA4 / Clarity theo mã trong Sheet) ---------- */
  var anDone = false;
  function analytics() {
    if (anDone) return; anDone = true;
    if (D.ga4 && /^G-/.test(D.ga4)) { var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + D.ga4; document.head.appendChild(s); window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag('js', new Date()); gtag('config', D.ga4); }
    if (D.clarity) { (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, 'clarity', 'script', D.clarity); }
  }
  if (D.ga4 || D.clarity) analytics();

  /* ---------- đầu trang ---------- */
  var mb = $('.menu-btn'), dr = $('#drawer');
  if (mb && dr) {
    mb.addEventListener('click', function () { dr.hidden = false; mb.setAttribute('aria-expanded', 'true'); var a = $('a', dr); if (a) a.focus(); });
    dr.addEventListener('click', function (e) { if (e.target === dr || e.target.closest('a')) { dr.hidden = true; mb.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dr.hidden) { dr.hidden = true; mb.focus(); } });
  }
  var ut = new URLSearchParams(location.search).get('utm_source'); if (ut) ls('mmm-utm', ut);

  /* ---------- giá trên thẻ vị, bảng giá ---------- */
  onData(function () {
    $$('[data-from]').forEach(function (e) { var t = e.dataset.from; e.textContent = fmt(unit(t, 'Thanh trùng', 100)); });
    $$('[data-pt]').forEach(function (tb) {
      var mode = tb.dataset.pt; // 'cot:Thanh trùng' → Original|Mix ; 'vi:Trà Earl Grey' → Thanh trùng|A2
      $$('tbody tr', tb).forEach(function (tr) {
        var size = +tr.dataset.size, td = $$('td', tr);
        if (mode.indexOf('cot:') === 0) { var cot = mode.slice(4); td[1].textContent = fmt(D.gia[cot][size]); td[2].textContent = fmt(D.gia[cot][size] + D.mix); }
        else { var v = mode.slice(3); td[1].textContent = fmt(unit(v, 'Thanh trùng', size)); td[2].textContent = fmt(unit(v, 'A2', size)); }
      });
    });
    set('mix', k(D.mix)); set('phi', fmt(D.ship.phi)); set('free', fmt(D.ship.free)); set('bk', D.ship.bk + 'km');
  });

  /* ---------- bộ chọn hũ (trang chủ + trang vị) ---------- */
  $$('[data-calc]').forEach(function (root) {
    var st = { vi: root.dataset.vi || 'Trà Earl Grey', cot: 'Thanh trùng', size: 250, sl: 1 };
    var pre = ls('mmm-pick'); if (pre && !root.dataset.fixed) { st.vi = pre.vi || st.vi; }
    function draw() {
      if (!viOf(st.vi)) st.vi = (vis()[2] || vis()[0]).ten;
      var u = unit(st.vi, st.cot, st.size), tot = u * st.sl, f = fl(st.vi);
      $$('[data-pick]', root).forEach(function (b) { var p = b.dataset.pick.split(':'), on = String(st[p[0]]) === p[1]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      SIZES.forEach(function (s) { set('p' + s, fmt(unit(st.vi, st.cot, s)), root); });
      set('a2add', '+' + k(D.gia.A2[st.size] - D.gia['Thanh trùng'][st.size]), root);
      set('a2p', fmt(unit(st.vi, 'A2', st.size)), root);
      set('name', f.full || st.vi, root); set('vname', f.ngan, root);
      set('meta', st.cot + ' · ' + st.size + 'g · ' + st.sl + ' hũ', root);
      set('unit', fmt(u), root); set('total', fmt(tot), root); set('qty', st.sl, root);
      set('formula', st.sl > 1 ? fmt(u) + ' / hũ × ' + st.sl : '/ hũ', root);
      $$('[data-o="btn"]', root).forEach(function (b) { b.textContent = 'Thêm vào giỏ · ' + fmt(tot); });
      $$('[data-o="btn"]').forEach(function (b) { if (!root.contains(b) && root.dataset.fixed) b.textContent = 'Thêm vào giỏ · ' + fmt(tot); });
      if (root.dataset.fixed) { var sb = $('.stickybuy'); if (sb) { set('meta', st.cot + ' · ' + st.size + 'g · ' + st.sl + ' hũ', sb); set('total', fmt(tot), sb); } }
      $$('[data-fimg]', root).forEach(function (e) { e.src = img(st.vi); e.alt = 'Sữa chua Hy Lạp vị ' + st.vi; });
      var t = totals(), after = t.hang + tot, need = D.ship.free - after;
      set('fsmsg', t.hang ? (need > 0 ? 'Giỏ đang có ' + fmt(t.hang) + ' · thêm hũ này còn ' + fmt(need) + ' nữa là freeship' : 'Giỏ đang có ' + fmt(t.hang) + ' · thêm hũ này là được freeship 5km') : (need > 0 ? 'Thêm hũ này, đơn còn ' + fmt(need) + ' nữa là freeship' : 'Riêng hũ này đã đủ freeship 5km'), root);
      $$('[data-o="fsstk"]', root).forEach(function (e) { e.hidden = need > 0; });
      var b1 = $('[data-o="fsbar1"]', root), b2 = $('[data-o="fsbar2"]', root);
      if (b1) { var a = Math.min(100, t.hang / D.ship.free * 100); b1.style.width = a + '%'; b2.style.width = Math.min(100 - a, tot / D.ship.free * 100) + '%'; }
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pick) { var p = b.dataset.pick.split(':'); st[p[0]] = p[0] === 'size' ? +p[1] : p[1]; draw(); return; }
      if (b.dataset.qty) { st.sl = Math.max(1, Math.min(30, st.sl + +b.dataset.qty)); draw(); return; }
      if (b.dataset.note) { var ta = $('[data-note-in]', root); if (ta && ta.value.indexOf(b.dataset.note) < 0) ta.value = (ta.value.trim() ? ta.value.trim().replace(/[,.]$/, '') + ', ' : '') + b.dataset.note; return; }
      if (b.dataset.add !== undefined) { add(); }
    });
    function add() {
      var ta = $('[data-note-in]', root);
      addCart({ t: 'le', vi: st.vi, cot: st.cot, size: st.size, sl: st.sl, note: ta ? ta.value.trim().slice(0, 150) : '' });
      toast('Đã thêm ' + st.sl + ' hũ ' + fl(st.vi).ngan + ' vào giỏ', '03-ngon-cai'); if (ta) ta.value = ''; st.sl = 1; draw();
    }
    if (root.dataset.fixed) $$('[data-add-ext]').forEach(function (b) { b.addEventListener('click', add); });
    root._set = function (vi) { st.vi = vi; draw(); };
    onData(draw);
  });
  // thẻ vị trên trang chủ: "Chọn hũ" đưa xuống bộ chọn
  $$('[data-choose]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var c = $('[data-calc]:not([data-fixed])'); if (!c) return; e.preventDefault();
      c._set(a.dataset.choose); ls('mmm-pick', { vi: a.dataset.choose }); var t = $('#tu-chon'); if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });
  $$('[data-quick]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); addCart({ t: 'le', vi: b.dataset.quick, cot: 'Thanh trùng', size: 100, sl: 1, note: '' }); toast('Đã thêm 1 hũ ' + fl(b.dataset.quick).ngan + ' 100g', '03-ngon-cai'); }); });

  /* ---------- combo ---------- */
  $$('[data-combo]').forEach(function (root) {
    var name = root.dataset.combo, st = { cot: 'Thanh trùng', set: 0, h250: { vi: 'Dâu sấy', cot: 'Thanh trùng' }, h450: { vi: 'Original ít đường', cot: 'Thanh trùng' } };
    var SETS = [['Original ít đường', 'Dâu sấy', 'Trà Earl Grey'], ['Original ít đường', 'Mè đen', 'Nhãn sấy']];
    function item() {
      if (/thử/i.test(name)) return { t: 'combo', combo: name, cot: st.cot, vis: SETS[st.set], sl: 1 };
      if (/đủ/i.test(name)) return { t: 'combo', combo: name, cot: st.cot, sl: 1 };
      return { t: 'combo', combo: name, hu: [{ vi: st.h250.vi, cot: st.h250.cot, size: 250 }, { vi: st.h450.vi, cot: st.h450.cot, size: 450 }], sl: 1 };
    }
    function draw() {
      var it = item(), p = priceItem(it), c = cb(name);
      root.hidden = c.ban === false;
      $$('[data-cot]', root).forEach(function (b) { var g = b.dataset.g || 'cot', cur = g === 'cot' ? st.cot : st[g].cot; b.classList.toggle('on', b.dataset.cot === cur); });
      $$('[data-set]', root).forEach(function (b) { b.classList.toggle('on', +b.dataset.set === st.set); });
      $$('[data-hv]', root).forEach(function (b) { var g = b.dataset.g; b.classList.toggle('on', st[g].vi === b.dataset.hv); });
      set('h250', fl(st.h250.vi).ngan, root); set('h450', fl(st.h450.vi).ngan, root);
      set('desc', itemMeta(it), root);
      set('price', fmt(p.gia), root); set('le', fmt(p.le), root); set('save', fmt(p.le - p.gia), root);
      $$('[data-o="le"]', root).forEach(function (e) { e.hidden = p.le <= p.gia; });
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cot) { var g = b.dataset.g || 'cot'; if (g === 'cot') st.cot = b.dataset.cot; else st[g].cot = b.dataset.cot; draw(); return; }
      if (b.dataset.set) { st.set = +b.dataset.set; draw(); return; }
      if (b.dataset.hv) { st[b.dataset.g].vi = b.dataset.hv; draw(); return; }
      if (b.dataset.addcombo !== undefined) { addCart(item()); toast('Đã thêm combo ' + name + ' vào giỏ', '03-ngon-cai'); }
    });
    onData(draw);
  });

  /* ---------- vùng giao (dùng chung) ---------- */
  var SHOP = [21.0186, 105.8136];
  function hav(a, b) { var R = 6371, r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2), y = Math.sin((b[1] - a[1]) * r / 2); return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a[0] * r) * Math.cos(b[0] * r) * y * y)); }
  function roadKm(ll) { return Math.round(Math.max(0.3, hav(SHOP, ll) * 1.3) * 10) / 10; }
  function norm(t) { return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim(); }
  GEO.STREETS.forEach(function (s) { s.n = norm(s[0]); }); GEO.ALIASES.forEach(function (a) { a.n = norm(a[0]); }); GEO.WARDS.forEach(function (w) { w.n = norm(w[1]); });
  function ward(id) { return GEO.WARDS.filter(function (w) { return w[0] === id; })[0]; }
  function locate(txt) {
    var n = ' ' + norm(txt) + ' ', hit = null;
    GEO.STREETS.forEach(function (s) { if (!hit && n.indexOf(' ' + s.n + ' ') >= 0) hit = { w: s[1], ll: [s[2], s[3]] }; });
    GEO.ALIASES.forEach(function (a) { var w = ward(a[1]); if (!hit && w && n.indexOf(' ' + a.n + ' ') >= 0) hit = { w: a[1], ll: [w[2], w[3]], area: true }; });
    GEO.WARDS.forEach(function (w) { if (!hit && n.indexOf(' ' + w.n + ' ') >= 0) hit = { w: w[0], ll: [w[2], w[3]], area: true }; });
    return hit;
  }
  function wardOptions(sel, val) { sel.innerHTML = '<option value="">Chọn phường / xã</option>' + GEO.WARDS.map(function (w) { return '<option value="' + w[0] + '"' + (w[0] === val ? ' selected' : '') + '>Phường ' + w[1] + '</option>'; }).join(''); }
  var shipChk = $('[data-shipcheck]');
  if (shipChk) {
    var sel = $('select', shipChk); wardOptions(sel, 'giang-vo');
    var showZone = function () {
      var w = ward(sel.value), z = $('[data-o="zone"]', shipChk); if (!w) { z.hidden = true; return; }
      var km = roadKm([w[2], w[3]]), inZ = km <= D.ship.bk; z.hidden = false; z.className = 'zone ' + (inZ ? 'in' : 'out');
      z.innerHTML = inZ ? '<b>Trong vùng giao ' + D.ship.bk + 'km</b> (khoảng ' + String(km).replace('.', ',') + ' km). Phí ' + fmt(D.ship.phi) + ', miễn phí khi tiền hàng từ ' + fmt(D.ship.free) + '.' : '<b>Ngoài ' + D.ship.bk + 'km</b> (khoảng ' + String(km).replace('.', ',') + ' km). Bạn trả ship trực tiếp cho shipper khi nhận, hoặc tự đến lấy.';
    };
    sel.addEventListener('change', showZone); onData(showZone);
  }

  /* ---------- trang giỏ hàng ---------- */
  if (PAGE === 'cart') onData(drawCart);
  function drawCart() {
    var c = cart(), box = $('[data-o="lines"]'), t = totals(c);
    set('count', t.hu + ' hũ');
    $('[data-o="empty"]').hidden = !!c.length; $('[data-o="full"]').hidden = !c.length;
    box.innerHTML = c.map(function (it, i) {
      var p = priceItem(it);
      return '<div class="ci"><div class="th"><img src="' + itemImg(it) + '" alt="" loading="lazy"></div><div><h3>' + esc(itemTitle(it)) + '</h3><div class="meta">' + esc(itemMeta(it)) + '</div>' + (it.note ? '<div class="meta">Lưu ý: ' + esc(it.note) + '</div>' : '') + (p.le > p.gia ? '<div class="meta pos">Tiết kiệm ' + fmt(p.le - p.gia) + (p.free ? ' + freeship 5km' : '') + '</div>' : '') + '</div>' +
        '<div class="ctl"><div class="qty"><button type="button" data-i="' + i + '" data-d="-1" aria-label="Giảm số lượng">−</button><span>' + it.sl + '</span><button type="button" data-i="' + i + '" data-d="1" aria-label="Tăng số lượng">+</button></div>' +
        '<div class="lt">' + fmt(p.gia) + '</div><button type="button" class="del" data-del="' + i + '" aria-label="Bỏ khỏi giỏ"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button></div></div>';
    }).join('');
    set('tien', fmt(t.hang));
    var need = D.ship.free - t.hang;
    set('shipline', (t.free || need <= 0 ? 'Miễn phí' : fmt(D.ship.phi)) + ' nếu trong ' + D.ship.bk + 'km');
    set('grand', fmt(t.hang + (t.free || need <= 0 ? 0 : D.ship.phi)));
    set('fshead', t.free || need <= 0 ? 'Đơn đã được freeship trong ' + D.ship.bk + 'km' : 'Còn ' + fmt(need) + ' nữa là freeship');
    set('fsratio', fmt(Math.min(t.hang, D.ship.free)) + ' / ' + fmt(D.ship.free));
    $$('[data-o="fsstk"]').forEach(function (e) { e.hidden = !(t.free || need <= 0); });
    var b = $('[data-o="fsbar1"]'); if (b) b.style.width = Math.min(100, (t.free ? 1 : t.hang / D.ship.free) * 100) + '%';
    var have = {}; c.forEach(function (it) { if (it.vi) have[it.vi] = 1; });
    var sug = vis().filter(function (v) { return !have[v.ten]; }).slice(0, 3);
    $('[data-o="sug"]').innerHTML = sug.map(function (v) { var u = unit(v.ten, 'Thanh trùng', 100); return '<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="row" style="flex-wrap:nowrap"><img src="' + img(v.ten) + '" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover"><div><b>' + esc(fl(v.ten).ngan) + '</b><div class="note">Thanh trùng · 100g · ' + fmt(u) + '</div></div></div><button type="button" class="btn btn-o btn-sm" data-quick2="' + esc(v.ten) + '">+ Thêm</button></div>'; }).join('');
    $('[data-o="sugwrap"]').hidden = !sug.length || t.free || need <= 0;
  }
  if (PAGE === 'cart') document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var c = cart();
    if (b.dataset.d) { var it = c[+b.dataset.i]; it.sl = Math.max(1, Math.min(30, it.sl + +b.dataset.d)); saveCart(c); drawCart(); }
    else if (b.dataset.del) { c.splice(+b.dataset.del, 1); saveCart(c); drawCart(); toast('Đã bỏ khỏi giỏ'); }
    else if (b.dataset.quick2) { addCart({ t: 'le', vi: b.dataset.quick2, cot: 'Thanh trùng', size: 100, sl: 1, note: '' }); drawCart(); toast('Đã thêm 1 hũ ' + fl(b.dataset.quick2).ngan); }
  });

  /* ---------- trang đặt hàng ---------- */
  if (PAGE === 'checkout') checkout();
  function vnNow() { var d = new Date(); return new Date(d.getTime() + (d.getTimezoneOffset() + 420) * 60000); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function buildDays(mode) {
    var now = vnNow(), mins = now.getHours() * 60 + now.getMinutes(), out = [];
    var THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    for (var i = 0; i < D.soNgay; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), id = iso(d);
      var khung = D.khung.filter(function (x) { return mode === 'Giao' ? x.giao : x.lay; }).map(function (x) {
        var m = x.gio.match(/(\d{1,2}):(\d{2})/), st = m ? +m[1] * 60 + +m[2] : 0;
        var past = i === 0 && st - D.khoaPhut < mins;
        var het = (D.het || []).some(function (h) { return h.ngay === id && (!h.gio || h.gio === x.gio) && (!h.ap || /cả|hai/i.test(h.ap) || (mode === 'Giao' ? /giao/i : /lấy/i).test(h.ap)); });
        return { gio: x.gio, ok: !past && !het, past: past, het: het };
      });
      out.push({ id: id, top: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : THU[d.getDay()], sub: (i < 2 ? THU[d.getDay()] + ' ' : '') + d.getDate() + '/' + (d.getMonth() + 1), khung: khung, ok: khung.some(function (x) { return x.ok; }) });
    }
    return out;
  }
  function checkout() {
    var form = $('#co-form'); if (!form) return;
    var c = cart(); if (!c.length) { $('[data-o="cempty"]').hidden = false; form.hidden = true; $('[data-o="side"]').hidden = true; return; }
    var t0 = Date.now(), st = { mode: 'Giao', day: null, slot: null, geo: null, g: null }, saved = ls('mmm-khach') || {};
    var F = function (n) { return form.elements[n]; };
    ['ten', 'sdt', 'diachi'].forEach(function (n) { if (saved[n]) F(n).value = saved[n]; });
    if (saved.mode) st.mode = saved.mode;
    var wsel = $('[name=ward]', form); wardOptions(wsel, saved.ward || '');
    track('begin_checkout', { currency: 'VND', value: totals().hang });
    if (window.MMMMaps && API) MMMMaps.init(API);
    var gOn = function () { return !!(window.MMMMaps && MMMMaps.on()); };
    function err(n, m) { var e = $('[data-err="' + n + '"]', form); if (e) { e.textContent = m || ''; e.hidden = !m; } }
    function km() { if (st.mode !== 'Giao') return 0; if (st.g) return st.g.km; return st.geo ? roadKm(st.geo.ll) : null; }
    function zone() { var x = km(); return x == null ? null : x <= D.ship.bk ? 'in' : 'out'; }
    function calc() {
      var t = totals(), z = zone(), ship = 0, label = 'Phí giao', txt = 'Không tính phí';
      if (st.mode === 'Giao') {
        if (!z) txt = 'Nhập địa chỉ để tính';
        else if (z === 'in') { label = 'Phí giao (trong ' + D.ship.bk + 'km)'; ship = t.hang >= D.ship.free || t.free ? 0 : D.ship.phi; txt = ship ? fmt(ship) : 'Miễn phí'; }
        else { label = 'Phí giao (ngoài ' + D.ship.bk + 'km)'; txt = 'Trả ship khi nhận hàng'; }
      }
      return { t: t, ship: ship, label: label, txt: txt, z: z };
    }
    function drawSide() {
      var c = cart(), r = calc();
      $('[data-o="slines"]').innerHTML = c.map(function (it) { var p = priceItem(it); return '<div class="si"><div class="th"><img src="' + itemImg(it) + '" alt=""></div><div><b>' + esc(itemTitle(it)) + (it.sl > 1 ? ' × ' + it.sl : '') + '</b><small>' + esc(itemMeta(it)) + '</small>' + (it.note ? '<small>Lưu ý: ' + esc(it.note) + '</small>' : '') + '</div><b>' + fmt(p.gia) + '</b></div>'; }).join('');
      set('tien', fmt(r.t.hang)); set('shiplabel', r.label); set('ship', r.txt); set('grand', fmt(r.t.hang + r.ship));
      set('when', st.slot ? (st.mode === 'Giao' ? 'Giao ' : 'Lấy ') + st.dayLabel + ' · ' + st.slot : 'Chưa chọn giờ');
      var zm = $('[data-o="zonemsg"]'); zm.hidden = st.mode !== 'Giao' || !r.z;
      if (r.z === 'in') { zm.className = 'zone in'; zm.innerHTML = '<b>Trong vùng giao ' + D.ship.bk + 'km.</b> ' + (r.ship ? 'Phí ' + fmt(D.ship.phi) + ' — thêm ' + fmt(D.ship.free - r.t.hang) + ' tiền hàng để được miễn phí.' : 'Đơn của bạn được miễn phí giao.'); }
      else if (r.z === 'out') { zm.className = 'zone out'; zm.innerHTML = '<b>Ngoài bán kính ' + D.ship.bk + 'km' + (r.t.free || r.t.hang >= D.ship.free ? ' — freeship không áp dụng.' : '.') + '</b> Phí ship tính theo quãng đường, bạn trả trực tiếp cho shipper khi nhận hàng. Chuyển khoản trước chỉ gồm tiền hàng. Có thể chọn "Tự đến lấy" để không mất phí.'; }
    }
    function drawWard() {
      var bx = $('[data-o="wardbox"]'), w = ward(wsel.value), x = km();
      if (st.g) { set('wardname', st.g.ward ? (/^(Phường|Xã) /.test(st.g.ward) ? st.g.ward : 'Phường ' + st.g.ward) : 'Theo Google Maps'); set('wardsub', 'Theo Google Maps · ' + String(st.g.km).replace('.', ',') + ' km đường xe máy' + (st.g.phut ? ' · khoảng ' + st.g.phut + ' phút' : '')); }
      else if (w) set('wardname', 'Phường ' + w[1]), set('wardsub', (st.geo && st.geo.auto ? 'Tự nhận từ địa chỉ · ' : 'Bạn tự chọn · ') + 'cách shop khoảng ' + String(x).replace('.', ',') + ' km');
      else if (F('diachi').value.trim().length >= 6) { set('wardname', 'Chưa nhận ra phường'); set('wardsub', 'Chọn địa chỉ trong gợi ý, hoặc bấm "Chọn tay"'); }
      else { set('wardname', 'Tự điền khi bạn nhập địa chỉ'); set('wardsub', 'Gõ số nhà và tên đường ở ô trên'); }
      bx.className = 'wardbox' + (x != null ? (x <= D.ship.bk ? ' ok' : ' far') : '');
      var mp = $('[data-o="map"]');
      if (st.mode === 'Giao' && st.g && gOn()) {
        var src = MMMMaps.embed(st.g.ll); mp.hidden = false;
        if (mp.dataset.src !== src) { mp.dataset.src = src; mp.innerHTML = '<iframe title="Đường từ shop đến bạn" src="' + src + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="mapbar"></div>'; }
        $('.mapbar', mp).innerHTML = '<div><div class="note">Từ shop (12 Nguyên Hồng) đến bạn</div><strong class="' + (st.g.km <= D.ship.bk ? 'pos' : 'neg') + '">' + String(st.g.km).replace('.', ',') + ' km · ' + (st.g.km <= D.ship.bk ? 'trong vùng ' + D.ship.bk + 'km' : 'ngoài vùng ' + D.ship.bk + 'km') + '</strong></div><a href="' + MMMMaps.link(st.g.ll) + '" target="_blank" rel="noopener">Xem đường trên Google Maps ↗</a>';
      } else { mp.hidden = true; }
      drawSide();
    }
    function detect() {
      var h = locate(F('diachi').value);
      if (h) { wsel.value = h.w; st.geo = { ll: h.ll, auto: true }; wsel.hidden = true; err('ward'); }
      else if (st.geo && st.geo.auto) { wsel.value = ''; st.geo = null; }
      drawWard();
    }
    // chế độ nhận
    function setMode(m) {
      st.mode = m; st.slot = null;
      $$('[data-mode]', form).forEach(function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      $$('[data-for]', form).forEach(function (s) { s.hidden = s.dataset.for !== m; });
      set('timetitle', m === 'Giao' ? 'Thời gian giao' : 'Thời gian lấy hàng'); set('daylabel', m === 'Giao' ? 'Ngày giao' : 'Ngày lấy'); set('slotlabel', m === 'Giao' ? 'Khung giờ giao' : 'Giờ lấy');
      drawSlots(); drawWard();
    }
    function drawSlots() {
      var days = buildDays(st.mode), cur = days.filter(function (d) { return d.id === st.day && d.ok; })[0] || days.filter(function (d) { return d.ok; })[0];
      st.day = cur ? cur.id : null; st.dayLabel = cur ? cur.top.toLowerCase() + ' ' + cur.sub.replace(/^.* /, '') : '';
      $('[data-o="days"]').innerHTML = days.map(function (d) { return '<button type="button" class="chip' + (d.id === st.day ? ' on' : '') + '" data-day="' + d.id + '"' + (d.ok ? '' : ' disabled') + ' role="radio" aria-checked="' + (d.id === st.day) + '"><b>' + d.top + '</b><small>' + d.sub + (d.ok ? '' : ' · hết giờ') + '</small></button>'; }).join('');
      var sl = $('[data-o="sleep"]'); if (sl) sl.hidden = days[0].ok;
      var kh = cur ? cur.khung : [];
      if (st.slot && !kh.some(function (x) { return x.gio === st.slot && x.ok; })) st.slot = null;
      $('[data-o="slots"]').innerHTML = kh.map(function (x) { return '<button type="button" class="chip' + (x.gio === st.slot ? ' on' : '') + '" data-slot="' + esc(x.gio) + '"' + (x.ok ? '' : ' disabled') + ' role="radio" aria-checked="' + (x.gio === st.slot) + '">' + esc(x.gio) + (x.ok ? '' : x.past ? ' · đã qua' : ' · hết hàng') + '</button>'; }).join('') || '<span class="note">Hiện chưa có khung giờ trống. Nhắn Zalo ' + esc(D.shop.sdt) + ' để shop sắp xếp nhé.</span>';
      drawSide();
    }
    form.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.mode) { setMode(b.dataset.mode); return; }
      if (b.dataset.day) { st.day = b.dataset.day; drawSlots(); return; }
      if (b.dataset.slot) { st.slot = b.dataset.slot; err('slot'); drawSlots(); return; }
      if (b.dataset.wardedit !== undefined) { wsel.hidden = !wsel.hidden; if (!wsel.hidden) wsel.focus(); return; }
    });
    wsel.addEventListener('change', function () { var w = ward(wsel.value); st.g = null; st.geo = w ? { ll: [w[2], w[3]], auto: false } : null; wsel.hidden = true; err('ward'); drawWard(); });
    // gợi ý địa chỉ
    var ai = F('diachi'), sg = $('[data-o="sug"]'), gT = 0, GS = [], dT = 0;
    ai.addEventListener('input', function () { st.g = null; err('diachi'); suggest(); clearTimeout(dT); dT = setTimeout(function () { if (!(st.geo && !st.geo.auto)) detect(); else drawWard(); }, 150); });
    ai.addEventListener('focus', suggest);
    ai.addEventListener('blur', function () { setTimeout(function () { sg.hidden = true; }, 180); });
    sg.addEventListener('mousedown', function (e) { e.preventDefault(); });
    function pinSvg() { return '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B4405E" stroke-width="2" style="flex:none;margin-top:3px"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'; }
    function suggest() {
      var q = ai.value; clearTimeout(gT);
      if (gOn()) {
        if (q.trim().length < 3 || st.g) { sg.hidden = true; return; }
        gT = setTimeout(function () { MMMMaps.suggest(q).then(function (list) { if (ai.value !== q) return; GS = list; sg.innerHTML = list.map(function (x, i) { return '<button type="button" data-g="' + i + '">' + pinSvg() + '<span><strong>' + esc(x.main) + '</strong><small>' + esc(x.sub) + (x.km != null ? ' · khoảng ' + String(x.km).replace('.', ',') + ' km' : '') + '</small></span></button>'; }).join(''); sg.hidden = !list.length; }).catch(function () { sg.hidden = true; }); }, 250);
        return;
      }
      var tail = norm(q).replace(/^((so|ngo|ngach|hem|nha|toa|p|k|\d+[a-z]?)\s+)+/, '').replace(/^\d+[a-z]?\s*/, '');
      if (tail.length < 2 || (locate(q) && /,/.test(q))) { sg.hidden = true; return; }
      var pre = (q.match(/^\s*((?:(?:số|ngõ|ngách|hẻm|nhà|ngo|so)\s*)?[\d\/a-zA-Z]*\d[\d\/a-zA-Z]*\s*)+/i) || [''])[0].trim();
      var hits = GEO.STREETS.filter(function (s) { return s.n.indexOf(tail) === 0 || s.n.indexOf(' ' + tail) >= 0; }).sort(function (a, b) { return (b.n.indexOf(tail) === 0) - (a.n.indexOf(tail) === 0) || a.n.length - b.n.length; }).slice(0, 6);
      if (!hits.length) { sg.hidden = true; return; }
      sg.innerHTML = hits.map(function (s) { var w = ward(s[1]); return '<button type="button" data-s="' + GEO.STREETS.indexOf(s) + '" data-pre="' + esc(pre) + '">' + pinSvg() + '<span><strong>' + esc((pre ? pre + ' ' : '') + s[0]) + '</strong><small>Phường ' + esc(w ? w[1] : '') + ', Hà Nội · khoảng ' + String(roadKm([s[2], s[3]])).replace('.', ',') + ' km</small></span></button>'; }).join('');
      sg.hidden = false;
    }
    sg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.g) {
        var x = GS[+b.dataset.g]; sg.innerHTML = '<div class="note" style="padding:12px 14px">Đang tính quãng đường…</div>';
        MMMMaps.pick(x).then(function (g) { st.g = g; ai.value = g.addr; sg.hidden = true; st.geo = { ll: [g.ll.lat, g.ll.lng], auto: true }; wsel.value = ''; wsel.hidden = true; err('diachi'); err('ward'); drawWard(); }).catch(function () { sg.hidden = true; });
        return;
      }
      var s = GEO.STREETS[+b.dataset.s], w = ward(s[1]);
      ai.value = (b.dataset.pre ? b.dataset.pre + ' ' : '') + s[0] + ', ' + (w ? w[1] : '') + ', Hà Nội'; sg.hidden = true; st.geo = null; detect(); err('diachi');
    });
    // gửi đơn
    var sending = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (sending) return;
      var ten = F('ten').value.trim(), sdt = F('sdt').value.replace(/\D/g, ''), ok = true, first = null;
      var bad = function (n, m) { err(n, m); ok = false; first = first || form.querySelector('[name="' + n + '"]') || $('[data-err="' + n + '"]', form); };
      ['ten', 'sdt', 'diachi', 'ward', 'slot'].forEach(function (n) { err(n); });
      if (ten.length < 2) bad('ten', 'Cho shop xin họ tên người nhận nhé.');
      if (!/^0\d{9}$/.test(sdt)) bad('sdt', 'Số điện thoại cần 10 số, bắt đầu bằng 0.');
      if (st.mode === 'Giao') {
        if (F('diachi').value.trim().length < 5) bad('diachi', 'Cần số nhà và tên đường để giao.');
        else if (km() == null) { bad('ward', 'Chọn phường / xã để tính phí giao.'); wsel.hidden = false; }
      }
      if (!st.slot) bad('slot', 'Chọn khung giờ nhận hàng nhé.');
      if (!ok) { if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      var c = cart(), r = calc(), w = ward(wsel.value);
      if (F('nho').checked) ls('mmm-khach', { ten: ten, sdt: sdt, diachi: F('diachi').value.trim(), ward: wsel.value, mode: st.mode }); else ls('mmm-khach', null);
      var body = { form: 'order', hp: F('website').value, ms: Date.now() - t0, ref: document.referrer ? new URL(document.referrer).hostname : '', data: {
        ten: ten, sdt: sdt, nhan: st.mode, diachi: F('diachi').value.trim(), phuong: st.g ? st.g.ward : w ? w[1] : '', km: km() || 0, ngay: st.day, slot: st.slot, ghichu: F('ghichu').value.trim(), utm: ls('mmm-utm') || '',
        items: c.map(function (it) { return it.t === 'combo' ? { combo: it.combo, cot: it.cot, vis: it.vis, hu: it.hu, sl: it.sl, note: it.note } : { vi: it.vi, cot: it.cot, size: it.size, sl: it.sl, note: it.note }; }) } };
      var bs = $$('[data-o="submit"]'), lab = function (on) { bs.forEach(function (b, i) { b.disabled = !on; b.textContent = on ? (i ? 'Thanh toán VietQR' : 'Tiếp tục · Thanh toán VietQR') : 'Đang gửi đơn…'; }); };
      sending = true; lab(false);
      var done = function (j) {
        ls('mmm-last', { ma: j.ma, sdt: sdt, ten: ten, tong: j.tong, hang: j.hang, ship: j.ship, ngoai: j.ngoai, nd: j.nd, nhan: st.mode, diachi: body.data.diachi + (body.data.phuong ? ', ' + body.data.phuong : ''), ngay: st.day, slot: st.slot, dayLabel: st.dayLabel, ghichu: body.data.ghichu, items: c, t: Date.now() });
        ls('mmm-cart', null); track('purchase', { transaction_id: j.ma, currency: 'VND', value: j.tong });
        location.href = '/thanh-toan/?ma=' + encodeURIComponent(j.ma);
      };
      if (!API) { done({ ma: 'MMMDEMO', tong: r.t.hang + r.ship, hang: r.t.hang, ship: r.ship, ngoai: r.z === 'out', nd: sdt + ' MMMDEMO' }); return; }
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (x) { return x.json(); }).then(function (j) {
        if (j.ok) return done(j);
        sending = false; lab(true);
        var m = j.msg || 'Chưa gửi được đơn, bạn thử lại nhé.';
        if (j.error === 'gio' || j.error === 'het') { err('slot', m); ls('mmm-data', null); } else if (j.error === 'sdt' || j.error === 'ten' || j.error === 'diachi') err(j.error, m); else toast(m);
      }).catch(function () { sending = false; lab(true); toast('Mạng chập chờn, bạn bấm gửi lại nhé. Hoặc nhắn Zalo ' + D.shop.sdt + '.'); });
    });
    setMode(st.mode);
    if (saved.ward && !locate(F('diachi').value)) { var w0 = ward(saved.ward); if (w0) st.geo = { ll: [w0[2], w0[3]], auto: false }; } else if (F('diachi').value) detect();
    onData(function () { drawSlots(); drawWard(); });
  }

  /* ---------- trang thanh toán ---------- */
  if (PAGE === 'pay') pay();
  function pay() {
    var ma = new URLSearchParams(location.search).get('ma') || '', L = ls('mmm-last');
    if (!L || L.ma !== ma) { $('[data-o="nolast"]').hidden = false; $('[data-o="paybox"]').hidden = true; return; }
    var B = D.bank, qr = 'https://img.vietqr.io/image/' + B.bin + '-' + B.stk + '-compact2.png?amount=' + L.tong + '&addInfo=' + encodeURIComponent(L.nd) + '&accountName=' + encodeURIComponent(B.chu);
    set('ma', L.ma); set('bank', B.ten); set('stk', B.stk.replace(/(\d{4})(?=\d)/g, '$1 ')); set('chu', B.chu); set('tong', fmt(L.tong)); set('nd', L.nd);
    var qi = $('[data-o="qr"]'), qe = $('[data-o="qrerr"]');
    qi.onerror = function () { qi.hidden = true; qe.hidden = false; }; qi.onload = function () { qi.hidden = false; qe.hidden = true; };
    $('[data-o="qrretry"]').onclick = function () { qe.hidden = true; qi.hidden = false; qi.src = qr + '&r=' + Date.now(); };
    qi.src = qr; $('[data-o="qrlink"]').href = qr;
    set('nguoi', L.ten + ' · ' + L.sdt); set('giao', L.nhan === 'Giao' ? 'Giao đến: ' + L.diachi : 'Tự đến lấy tại ' + D.shop.dc);
    set('when', (L.nhan === 'Giao' ? 'Giao ' : 'Lấy ') + (L.dayLabel || L.ngay) + ' · ' + L.slot);
    $('[data-o="gc"]').hidden = !L.ghichu; set('gcv', L.ghichu || '');
    $('[data-o="slines"]').innerHTML = (L.items || []).map(function (it) { var p = priceItem(it); return '<div class="si"><div class="th"><img src="' + itemImg(it) + '" alt=""></div><div><b>' + esc(itemTitle(it)) + (it.sl > 1 ? ' × ' + it.sl : '') + '</b><small>' + esc(itemMeta(it)) + '</small></div><b>' + fmt(p.gia) + '</b></div>'; }).join('');
    set('hang', fmt(L.hang)); set('ship', L.nhan !== 'Giao' ? 'Không tính phí' : L.ngoai ? 'Trả shipper khi nhận' : L.ship ? fmt(L.ship) : 'Miễn phí');
    if (/FBAN|FBAV|Zalo|Instagram|Line\//i.test(navigator.userAgent)) set('saveqr', 'Nhấn giữ ảnh QR để lưu');
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]'); if (!b) return;
      var v = b.dataset.copy === 'stk' ? B.stk : b.dataset.copy === 'tong' ? String(L.tong) : L.nd;
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { b.textContent = 'Đã chép'; b.classList.add('done'); setTimeout(function () { b.textContent = 'Chép'; b.classList.remove('done'); }, 1800); }, function () { toast(v); });
    });
    var paidBtn = $('[data-o="paid"]');
    paidBtn.addEventListener('click', function () { ls('mmm-paidclick-' + L.ma, 1); paidBtn.textContent = 'Shop đang kiểm tra…'; paidBtn.disabled = true; toast('Cảm ơn bạn! Shop kiểm tra tài khoản rồi nhắn Zalo / gọi xác nhận.'); poll(); });
    if (ls('mmm-paidclick-' + L.ma)) { paidBtn.textContent = 'Shop đang kiểm tra…'; paidBtn.disabled = true; }
    var tries = 0;
    function step(paid, xl) {
      var lis = $$('.track li'), n = xl === 'Hoàn tất' ? 4 : /Đang giao|Chờ lấy|Sẵn sàng|Đang làm/.test(xl || '') && paid ? 3 : paid ? 2 : 1;
      lis.forEach(function (li, i) { li.className = i < n ? 'done' : i === n ? 'cur' : ''; });
      if (paid) { var ok = $('[data-o="okstk"]'); if (ok && !/tim-ma/.test(ok.src)) { ok.src = '/img/stk/02-tim-ma.webp'; ok.classList.remove('pop'); void ok.offsetWidth; ok.classList.add('pop'); } set('payhead', 'Shop đã nhận tiền'); paidBtn.hidden = true; $('[data-o="qrcard"]').hidden = true; }
      set('recv', (L.nhan === 'Giao' ? 'Giao ' : 'Lấy ') + (L.dayLabel || L.ngay) + ' · ' + L.slot);
    }
    function poll() {
      if (!API || tries++ > 40) return;
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ form: 'status', ma: L.ma, sdt: L.sdt }) }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.ok) { var paid = j.pay === 'Đã thanh toán'; step(paid, j.xl); if (paid) return; }
        setTimeout(poll, 20000);
      }).catch(function () { setTimeout(poll, 30000); });
    }
    step(false, ''); poll();
  }

  badge();
  window.MMM = { cart: cart, totals: totals, priceItem: priceItem, data: function () { return D; } };
})();
