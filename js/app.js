/* Точки самопомощи — логика приложения. Без фреймворков и сборки.
   Данные: data/cards.json (карточки, симптомы, общие правила), data/doctor.json.
   Личные метки и заметки: localStorage этого телефона (ключ STORE_KEY). */
(function () {
  'use strict';

  var STORE_KEY = 'tochki_user_v1';
  var app = document.getElementById('app');
  var DATA = null;      // cards.json
  var DOCTOR = null;    // doctor.json
  var cardById = {};
  var searchText = '';
  var homeTab = 'body';

  var STATUS = {
    verified_self: { label: 'Проверено на себе', cls: 'st-ok' },
    reference: { label: 'По справочникам', cls: 'st-ref' }
  };
  var METHODS = [
    { id: 'fingers', label: 'Пальцы / костяшки' },
    { id: 'ball', label: 'Теннисный мяч' },
    { id: 'roller', label: 'Массажный валик' }
  ];

  /* ---------- мелкие утилиты ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function list(items, cls) {
    if (!items || !items.length) return '';
    return '<ul' + (cls ? ' class="' + cls + '"' : '') + '>' +
      items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }

  /* ---------- личные данные ---------- */
  function loadUser() {
    try {
      var u = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (!u || typeof u !== 'object') u = {};
      if (!u.cards || typeof u.cards !== 'object') u.cards = {};
      return u;
    } catch (e) { return { cards: {} }; }
  }
  function saveUser(u) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(u)); return true; }
    catch (e) { alert('Не удалось сохранить: хранилище телефона недоступно.'); return false; }
  }
  function userCard(id) { return loadUser().cards[id] || {}; }
  function setUserCard(id, patch) {
    var u = loadUser();
    var rec = u.cards[id] || {};
    Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
    rec.updated = new Date().toISOString();
    if (!rec.status && !rec.note) delete u.cards[id]; else u.cards[id] = rec;
    saveUser(u);
  }
  function statusOf(card) { return userCard(card.id).status || card.status || 'reference'; }

  /* ---------- поиск ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function words(s) { return norm(s).split(/[^a-zа-я0-9]+/).filter(Boolean); }
  // грубое отсечение окончаний: «колено/колена/коленом» -> «колен»
  function stem(w) {
    if (w.length > 6) return w.slice(0, -2);
    if (w.length > 3) return w.slice(0, -1);
    return w;
  }
  var STOP = { 'в': 1, 'на': 1, 'и': 1, 'не': 1, 'при': 1, 'по': 1, 'с': 1, 'у': 1, 'к': 1, 'от': 1, 'за': 1, 'под': 1, 'или': 1, 'как': 1, 'что': 1, 'до': 1, 'из': 1 };

  function buildIndex() {
    DATA.cards.forEach(function (c) {
      var zoneNames = (c.zones || []).map(function (z) { return Body.ZONE_NAMES[z] || ''; });
      c._strong = words([c.name_ru, c.name_lat, c.code || '', (c.name_ru || '').replace(/-/g, ''), c.meridian || '', (c.keywords || []).join(' '), zoneNames.join(' ')].join(' '));
      c._weak = words([(c.symptoms || []).join(' '), c.referred].join(' '));
    });
    (DATA.symptoms || []).forEach(function (s) { s._w = words(s.text + ' ' + (s.keywords || []).join(' ')); });
  }
  function hits(tokens, bag) {
    var n = 0;
    tokens.forEach(function (t) {
      for (var i = 0; i < bag.length; i++) if (bag[i].indexOf(t) === 0) { n++; break; }
    });
    return n;
  }
  function search(q) {
    var tokens = words(q).filter(function (w) { return !STOP[w]; }).map(stem);
    if (!tokens.length) return { cards: [], symptoms: [] };
    var score = {};
    DATA.cards.forEach(function (c) {
      var s = hits(tokens, c._strong) * 3 + hits(tokens, c._weak) * 2;
      if (s) score[c.id] = s;
    });
    var syms = [];
    (DATA.symptoms || []).forEach(function (s) {
      var h = hits(tokens, s._w);
      if (!h) return;
      syms.push({ s: s, h: h });
      s.cards.forEach(function (id) { score[id] = (score[id] || 0) + h; });
    });
    syms.sort(function (a, b) { return b.h - a.h; });
    var cards = Object.keys(score).sort(function (a, b) { return score[b] - score[a]; })
      .map(function (id) { return cardById[id]; }).filter(Boolean);
    return { cards: cards, symptoms: syms.map(function (x) { return x.s; }) };
  }

  /* ---------- общие куски разметки ---------- */
  function badge(card) {
    var st = STATUS[statusOf(card)] || STATUS.reference;
    return '<span class="badge ' + st.cls + '">' + st.label + '</span>';
  }
  function isAcu(c) { return c.kind === 'acu'; }
  function title(c) { return isAcu(c) ? c.code + ' · ' + c.name_ru : c.name_ru; }
  function muscles() { return DATA.cards.filter(function (c) { return !isAcu(c); }); }
  function acupoints() { return DATA.cards.filter(isAcu); }
  function cardRow(card) {
    var note = userCard(card.id).note;
    return '<a class="row' + (isAcu(card) ? ' row-acu' : '') + '" href="#/card/' + esc(card.id) + '">' +
      '<span class="row-main"><b>' + esc(title(card)) + '</b>' +
      '<small>' + esc(card.short || card.name_lat) + '</small></span>' +
      '<span class="row-side">' + badge(card) + (note ? '<small class="has-note">есть заметка</small>' : '') + '</span></a>';
  }
  function cardList(cards) {
    if (!cards.length) return '<p class="muted">Пока нет карточек.</p>';
    return '<div class="rows">' + cards.map(cardRow).join('') + '</div>';
  }
  var DISCLAIMER = '<p class="disclaimer">Это инструмент для снятия мышечного напряжения. Не лечение и не диагностика. ' +
    'Колени и локоть всё равно нужно показать ортопеду.</p>';

  function bodySvg(view) {
    var active = {};
    DATA.cards.forEach(function (c) { (c.zones || []).forEach(function (z) { active[z] = true; }); });
    var id = 'clip-' + view;
    var s = '<svg class="body" viewBox="50 4 140 454" role="img" aria-label="' + (view === 'front' ? 'Тело спереди' : 'Тело сзади') + '">' +
      '<defs><clipPath id="' + id + '-t"><path d="' + Body.torsoPath() + '"/></clipPath>' +
      '<clipPath id="' + id + '-a"><path d="' + Body.armPath(1) + '"/><path d="' + Body.armPath(-1) + '"/></clipPath></defs>' +
      Body.silhouette(view, { fill: 'var(--body-fill)', stroke: 'var(--body-stroke)', detail: 'var(--body-detail)' });
    ['a', 't'].forEach(function (layer) {
      s += '<g clip-path="url(#' + id + '-' + layer + ')">';
      Body.ZONES[view].forEach(function (z) {
        if (z.on !== layer) return;
        s += '<rect class="zone' + (active[z.id] ? ' zone-on' : '') + '" data-zone="' + z.id + '" x="40" y="' + z.y[0] +
          '" width="160" height="' + (z.y[1] - z.y[0]) + '"><title>' + esc(Body.ZONE_NAMES[z.id]) + '</title></rect>';
      });
      s += '</g>';
    });
    return s + '</svg>';
  }

  /* ---------- экраны ---------- */
  function viewHome() {
    var h = '<header class="top"><h1>Точки самопомощи</h1>' +
      '<a class="gear" href="#/settings" aria-label="Заметки и настройки">Заметки ⚙︎</a></header>' +
      '<div class="searchbox"><input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" ' +
      'placeholder="Слово или симптом: колено, судорога икр…" value="' + esc(searchText) + '" aria-label="Поиск по слову или симптому"></div>' +
      '<div id="home-body"></div>';
    app.innerHTML = h;
    var q = document.getElementById('q');
    q.addEventListener('input', function () { searchText = q.value; renderHomeBody(); });
    renderHomeBody();
  }

  function renderHomeBody() {
    var box = document.getElementById('home-body');
    if (!box) return;
    var h = '';
    if (searchText.trim()) {
      var r = search(searchText);
      if (r.symptoms.length) {
        h += '<h2>Похожие симптомы</h2><div class="chips">' + r.symptoms.slice(0, 6).map(function (s) {
          return '<a class="chip" href="#/symptom/' + esc(s.id) + '">' + esc(s.text) + '</a>';
        }).join('') + '</div>';
      }
      h += '<h2>Карточки</h2>';
      h += r.cards.length ? cardList(r.cards)
        : '<p class="muted">Ничего не нашлось. Попробуйте одно слово: «колено», «лопатка», «пятка», «судорога». ' +
          'Или откройте вкладку «Симптомы».</p>';
      box.innerHTML = h;
      return;
    }
    h += '<div class="seg" role="tablist">' +
      '<button role="tab" data-tab="body" class="' + (homeTab === 'body' ? 'on' : '') + '">Тело</button>' +
      '<button role="tab" data-tab="symptoms" class="' + (homeTab === 'symptoms' ? 'on' : '') + '">Симптомы</button>' +
      '<button role="tab" data-tab="all" class="' + (homeTab === 'all' ? 'on' : '') + '">Мышцы</button>' +
      '<button role="tab" data-tab="acu" class="' + (homeTab === 'acu' ? 'on' : '') + '">Точки ВОЗ</button></div>';
    if (homeTab === 'body') {
      h += '<p class="hint">Нажмите на зону тела. Подсвечены зоны, для которых уже есть карточки.</p>' +
        '<div class="bodies"><figure>' + bodySvg('front') + '<figcaption>Спереди</figcaption></figure>' +
        '<figure>' + bodySvg('back') + '<figcaption>Сзади</figcaption></figure></div>';
    } else if (homeTab === 'symptoms') {
      h += '<p class="hint">Выберите, что беспокоит, и получите подборку карточек.</p><div class="rows">' +
        (DATA.symptoms || []).map(function (s) {
          return '<a class="row" href="#/symptom/' + esc(s.id) + '"><span class="row-main"><b>' + esc(s.text) +
            '</b></span><span class="row-side"><small>' + s.cards.length + ' карт.</small></span></a>';
        }).join('') + '</div>';
    } else if (homeTab === 'acu') {
      h += '<p class="hint">Классические китайские точки (нумерация ВОЗ) — дополнение к мышечным карточкам. ' +
        'Расстояния даны в цунях: <a href="#/rules">как мерить цунь</a>.</p>';
      var byMer = {}, order = [];
      acupoints().forEach(function (c) {
        if (!byMer[c.meridian]) { byMer[c.meridian] = []; order.push(c.meridian); }
        byMer[c.meridian].push(c);
      });
      order.forEach(function (m) { h += '<h2 class="mer">' + esc(m) + '</h2>' + cardList(byMer[m]); });
    } else {
      h += cardList(muscles());
    }
    h += DISCLAIMER + '<p class="links"><a href="#/rules">Общие правила нажима</a> · <a href="#/settings">Заметки: экспорт и импорт</a></p>';
    box.innerHTML = h;
  }

  function viewZone(id) {
    var name = Body.ZONE_NAMES[id];
    if (!name) return viewNotFound();
    var inZone = function (c) { return (c.zones || []).indexOf(id) >= 0; };
    var ms = muscles().filter(inZone), ac = acupoints().filter(inZone);
    app.innerHTML = '<header class="top"><a class="back" href="#/">‹ Назад</a><h1>' + esc(name) + '</h1></header>' +
      (ms.length ? '<p class="hint">Мышцы этой зоны. Боль часто отдаёт не туда, где сидит точка — смотрите описание в карточке.</p>' + cardList(ms)
        : '<p class="muted">Мышечных карточек для этой зоны пока нет. Попробуйте поиск по симптому на главном экране.</p>') +
      (ac.length ? '<h2>Китайские точки</h2>' + cardList(ac) : '') + DISCLAIMER;
  }

  function viewSymptom(id) {
    var s = (DATA.symptoms || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return viewNotFound();
    var cards = s.cards.map(function (cid) { return cardById[cid]; }).filter(Boolean);
    app.innerHTML = '<header class="top"><a class="back" href="#/">‹ Назад</a><h1>' + esc(s.text) + '</h1></header>' +
      (s.note ? '<p class="warn">' + esc(s.note) + '</p>' : '') +
      '<p class="hint">Проверьте мышцы по порядку: начните с первой карточки.</p>' + cardList(cards) + DISCLAIMER;
  }

  function methodBlock(m, data, open) {
    if (!data) return '';
    var h = '<details class="method"' + (open ? ' open' : '') + '><summary>' + m.label + '</summary>';
    if (data.na) return h + '<p class="muted">' + esc(data.na) + '</p></details>';
    h += '<dl>' +
      '<dt>Положение</dt><dd>' + esc(data.position) + '</dd>' +
      '<dt>Как давить</dt><dd>' + esc(data.how) + '</dd>' +
      '<dt>Сила</dt><dd>' + esc(data.force) + '</dd>' +
      '<dt>Время</dt><dd>' + esc(data.time) + '</dd>' +
      '<dt>Дыхание</dt><dd>' + esc(data.breathing) + '</dd></dl></details>';
    return h;
  }

  // «Рядом»: мышцы и китайские точки той же зоны тела. Выше в списке — явно связанные
  // (поле related у точки), затем те, у кого больше общих зон.
  function linked(a, b) {
    return (a.related || []).indexOf(b.id) >= 0 || (b.related || []).indexOf(a.id) >= 0;
  }
  // соседние зоны — запасной вариант, если в своей зоне мало карточек
  var ADJ = {
    head: ['neck'], neck: ['head', 'shoulder', 'upper_back'], shoulder: ['neck', 'upper_back', 'arm_front', 'arm_back', 'chest'],
    chest: ['shoulder', 'abdomen', 'arm_front'], abdomen: ['chest', 'lower_back', 'thigh_front'],
    upper_back: ['neck', 'shoulder', 'lower_back'], lower_back: ['upper_back', 'glutes', 'abdomen'],
    glutes: ['lower_back', 'thigh_back', 'thigh_front'], arm_front: ['shoulder', 'elbow'], arm_back: ['shoulder', 'elbow'],
    elbow: ['arm_front', 'arm_back', 'forearm'], forearm: ['elbow', 'hand'], hand: ['forearm'],
    thigh_front: ['glutes', 'knee', 'abdomen'], thigh_back: ['glutes', 'knee'], knee: ['thigh_front', 'thigh_back', 'shin', 'calf'],
    shin: ['knee', 'foot', 'calf'], calf: ['knee', 'foot', 'shin'], foot: ['shin', 'calf']
  };
  function nearby(c, max) {
    max = max || 6;
    var zs = c.zones || [], adj = [];
    zs.forEach(function (z) { (ADJ[z] || []).forEach(function (a) { if (zs.indexOf(a) < 0 && adj.indexOf(a) < 0) adj.push(a); }); });
    var scored = DATA.cards.filter(function (x) { return x.id !== c.id; }).map(function (x) {
      var xz = x.zones || [];
      var common = xz.filter(function (z) { return zs.indexOf(z) >= 0; }).length;
      var side = xz.filter(function (z) { return adj.indexOf(z) >= 0; }).length;
      return { c: x, same: common > 0 || linked(c, x), score: (linked(c, x) ? 100 : 0) + common * 10 + side };
    }).filter(function (o) { return o.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    var res = { muscles: [], acu: [] };
    scored.forEach(function (o) {
      var bucket = isAcu(o.c) ? res.acu : res.muscles;
      // из соседних зон добираем, только пока в списке меньше трёх карточек
      if (bucket.length < max && (o.same || bucket.length < 3)) bucket.push(o.c);
    });
    return res;
  }

  function viewCard(id) {
    var c = cardById[id];
    if (!c) return viewNotFound();
    var st = statusOf(c), u = userCard(id);
    var h = '<header class="top"><a class="back" href="javascript:history.back()">‹ Назад</a></header>' +
      '<article class="card' + (isAcu(c) ? ' card-acu' : '') + '">' +
      (isAcu(c) ? '<p class="kind">Китайская точка · ' + esc(c.code) + '</p>' : '') +
      '<h1>' + esc(c.name_ru) + '</h1><p class="lat">' + esc(isAcu(c) ? c.name_lat + ' · ' + c.meridian : c.name_lat) + '</p>' +
      '<button id="st-toggle" class="status ' + STATUS[st].cls + '" aria-pressed="' + (st === 'verified_self') + '">' +
      '<span class="dot"></span>' + STATUS[st].label + '<small>нажмите, чтобы изменить</small></button>';
    if (st === 'reference') {
      h += '<p class="warn">Карточка составлена по справочникам и на вас не проверена. Давите осторожно; ' +
        'при острой или нарастающей боли сразу остановитесь.</p>';
    }
    if (c.svg) {
      h += '<figure class="scheme"><img src="' + esc(c.svg) + '" alt="Схема: ' + esc(c.name_ru) + '">' +
        '<figcaption>' + (isAcu(c) ? '<span class="lg lg-acu"></span>точка <span class="lg lg-measure"></span>разметка в цунях'
          : '<span class="lg lg-muscle"></span>мышца <span class="lg lg-point"></span>точка нажима <span class="lg lg-pain"></span>куда отдаёт боль') +
        (c.svg_note ? '<br>' + esc(c.svg_note) : '') +
        '<br>Схема показывает зону; точное место — по ориентирам ниже.</figcaption></figure>';
    }
    h += '<section><h2>' + (isAcu(c) ? 'Для чего используют (по традиции)' : 'Куда отдаёт боль') + '</h2><p>' + esc(c.referred) + '</p>' +
      list(c.symptoms, 'tags') + '</section>';

    h += '<section><h2>Как найти точку</h2>';
    if (c.find_intro) h += '<p>' + esc(c.find_intro) + '</p>';
    if (isAcu(c)) h += '<p class="small"><a href="#/rules">Как мерить цунь</a> — 1 цунь ≈ ширина вашего большого пальца.</p>';
    (c.points || []).forEach(function (p) {
      h += '<div class="point"><h3><span class="num">' + esc(p.n) + '</span>' + esc(p.title) + '</h3><ol>' +
        p.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>';
    });
    h += '</section>';

    h += '<section><h2>Чем и как давить</h2>';
    var opened = false;
    METHODS.forEach(function (m) {
      var d = c.methods && c.methods[m.id];
      var open = !opened && d && !d.na && (c.best_method ? c.best_method === m.id : true);
      if (open) opened = true;
      h += methodBlock(m, d, open);
    });
    h += '<p class="muted small">Сила — по шкале дискомфорта от 1 до 10. Рабочий уровень 4–6, не выше 7. ' +
      '<a href="#/rules">Общие правила</a></p></section>';

    h += '<section><h2>Что должно ощущаться</h2><h3 class="ok">Нормально</h3>' + list(c.sensation && c.sensation.ok) +
      '<h3 class="stop">Стоп-сигналы — прекратить</h3>' + list(c.sensation && c.sensation.stop) + '</section>';
    h += '<section><h2>Не давить, если…</h2>' + list(c.contra) + '</section>';
    h += '<section><h2>Что делать после</h2>' + list(c.after) + '</section>';

    h += '<section><h2>Моя заметка</h2><textarea id="note" rows="4" placeholder="Например: нашёл точнее на 2 пальца ниже">' +
      esc(u.note || '') + '</textarea><p id="note-state" class="muted small">Сохраняется автоматически, только в этом телефоне.</p></section>';
    var near = nearby(c);
    if (near.muscles.length) h += '<section><h2>Мышцы рядом</h2>' + cardList(near.muscles) + '</section>';
    if (near.acu.length) h += '<section><h2>Китайские точки рядом</h2>' + cardList(near.acu) + '</section>';
    h += '<section class="sources"><h2>Источники</h2>' + list(c.sources) + '</section></article>' + DISCLAIMER;
    app.innerHTML = h;

    document.getElementById('st-toggle').addEventListener('click', function () {
      var next = statusOf(c) === 'verified_self' ? 'reference' : 'verified_self';
      setUserCard(id, { status: next === c.status ? '' : next });
      var y = window.scrollY; viewCard(id); window.scrollTo(0, y);
    });
    var note = document.getElementById('note'), state = document.getElementById('note-state'), timer;
    function persist() { setUserCard(id, { note: note.value.trim() }); state.textContent = 'Сохранено ✓'; }
    note.addEventListener('input', function () {
      state.textContent = 'Сохраняю…'; clearTimeout(timer); timer = setTimeout(persist, 400);
    });
    note.addEventListener('blur', function () { clearTimeout(timer); persist(); });
  }

  function viewDoctor() {
    var d = DOCTOR;
    var h = '<header class="top"><a class="back" href="javascript:history.back()">‹ Назад</a><h1>Когда срочно к врачу</h1></header>' +
      '<p class="lead">' + esc(d.intro) + '</p>';
    d.groups.forEach(function (g) {
      h += '<section class="doc doc-' + esc(g.level) + '"><h2>' + esc(g.title) + '</h2>';
      if (g.action) h += '<p class="action">' + esc(g.action) + '</p>';
      if (g.level === 'emergency') {
        h += '<p class="calls"><a class="call" href="tel:103">Позвонить 103</a><a class="call" href="tel:112">Позвонить 112</a></p>';
      }
      g.items.forEach(function (it) {
        h += '<div class="doc-item"><h3>' + esc(it.title) + '</h3>' + list(it.signs) +
          (it.note ? '<p class="small">' + esc(it.note) + '</p>' : '') +
          '<p class="src">Источник: ' + it.sources.map(function (k) {
            var s = d.sources[k];
            return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>' : '';
          }).join('; ') + '</p></div>';
      });
      h += '</section>';
    });
    h += '<section class="sources"><h2>Откуда этот список</h2><p>' + esc(d.source_note) + '</p><ul>' +
      Object.keys(d.sources).map(function (k) {
        var s = d.sources[k];
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>' +
          (s.reviewed ? ' — редакция страницы от ' + esc(s.reviewed) : '') + '</li>';
      }).join('') + '</ul><p class="muted small">Сверено: ' + esc(d.checked) + '</p></section>';
    app.innerHTML = h;
  }

  function viewRules() {
    var r = DATA.rules;
    app.innerHTML = '<header class="top"><a class="back" href="javascript:history.back()">‹ Назад</a><h1>Общие правила</h1></header>' +
      r.map(function (s) { return '<section><h2>' + esc(s.title) + '</h2>' + list(s.items) + '</section>'; }).join('') + DISCLAIMER;
  }

  function viewSettings() {
    var u = loadUser(), n = Object.keys(u.cards).length;
    var h = '<header class="top"><a class="back" href="#/">‹ Назад</a><h1>Заметки и метки</h1></header>' +
      '<p>Ваши метки «проверено на себе» и заметки хранятся только в этом телефоне. iOS иногда очищает данные сайтов, ' +
      'поэтому время от времени сохраняйте резервную копию в файл.</p>' +
      '<p class="muted">Сейчас сохранено записей: <b id="cnt">' + n + '</b></p>' +
      '<div class="btns"><button id="exp" class="btn">Экспорт заметок в файл</button>' +
      '<label class="btn btn-2">Импорт заметок из файла<input id="imp" type="file" accept=".json,application/json,text/plain" hidden></label>' +
      '<button id="txt" class="btn btn-2">Показать копию текстом</button></div>' +
      '<div id="io" class="io"></div>';
    if (n) {
      h += '<h2>Мои записи</h2><div class="rows">' + Object.keys(u.cards).map(function (id) {
        var c = cardById[id]; if (!c) return '';
        return '<a class="row" href="#/card/' + esc(id) + '"><span class="row-main"><b>' + esc(c.name_ru) + '</b><small>' +
          esc(u.cards[id].note || 'без заметки') + '</small></span><span class="row-side">' + badge(c) + '</span></a>';
      }).join('') + '</div>';
    }
    h += '<h2>О приложении</h2><p class="muted small">Версия данных: ' + esc(DATA.version) +
      '. Работает без интернета после первой загрузки. <span id="persist"></span></p>';
    app.innerHTML = h;

    var io = document.getElementById('io');
    function payload() {
      return JSON.stringify({ app: 'tochki-samopomoshchi', format: 1, exported: new Date().toISOString(), cards: loadUser().cards }, null, 2);
    }
    document.getElementById('exp').addEventListener('click', function () {
      var name = 'tochki-zametki-' + new Date().toISOString().slice(0, 10) + '.json';
      var text = payload();
      var file = null;
      try { file = new File([text], name, { type: 'application/json' }); } catch (e) { /* старый браузер */ }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Заметки: точки самопомощи' }).then(function () {
          io.innerHTML = '<p class="ok-msg">Готово. Выберите «Сохранить в Файлы», чтобы копия осталась в телефоне или iCloud.</p>';
        }).catch(function () { /* пользователь закрыл окно */ });
        return;
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      io.innerHTML = '<p class="ok-msg">Файл ' + esc(name) + ' сохранён в загрузки.</p>';
    });
    document.getElementById('txt').addEventListener('click', function () {
      io.innerHTML = '<p class="small muted">Скопируйте текст и сохраните в «Заметки». Чтобы восстановить — вставьте его сюда и нажмите «Импорт из текста».</p>' +
        '<textarea id="raw" rows="8" spellcheck="false">' + esc(payload()) + '</textarea>' +
        '<button id="raw-imp" class="btn btn-2">Импорт из текста</button>';
      document.getElementById('raw-imp').addEventListener('click', function () { doImport(document.getElementById('raw').value); });
    });
    document.getElementById('imp').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { doImport(String(rd.result)); };
      rd.onerror = function () { io.innerHTML = '<p class="err-msg">Не удалось прочитать файл.</p>'; };
      rd.readAsText(f);
    });
    function doImport(text) {
      var d;
      try { d = JSON.parse(text); } catch (e) { d = null; }
      if (!d || typeof d.cards !== 'object' || !d.cards) {
        io.innerHTML = '<p class="err-msg">Это не файл заметок приложения. Ничего не изменено.</p>'; return;
      }
      var u = loadUser(), added = 0;
      Object.keys(d.cards).forEach(function (id) {
        var src = d.cards[id]; if (!src || typeof src !== 'object') return;
        var cur = u.cards[id];
        // при конфликте остаётся более свежая запись
        if (cur && cur.updated && src.updated && cur.updated > src.updated) return;
        var rec = { updated: String(src.updated || new Date().toISOString()) };
        if (src.status === 'verified_self' || src.status === 'reference') rec.status = src.status;
        if (typeof src.note === 'string' && src.note) rec.note = src.note.slice(0, 5000);
        if (rec.status || rec.note) { u.cards[id] = rec; added++; }
      });
      if (saveUser(u)) {
        viewSettings();
        document.getElementById('io').innerHTML = '<p class="ok-msg">Импортировано записей: ' + added + '.</p>';
      }
    }
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        var el = document.getElementById('persist');
        if (el) el.textContent = p ? 'Хранилище защищено от автоочистки.' : 'Защита от автоочистки не гарантирована — делайте экспорт.';
      });
    }
  }

  function viewNotFound() {
    app.innerHTML = '<header class="top"><a class="back" href="#/">‹ На главную</a><h1>Не найдено</h1></header>' +
      '<p class="muted">Такой страницы нет.</p>';
  }

  /* ---------- маршрутизация ---------- */
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var id = decodeURIComponent(parts[1] || '');
    document.body.classList.toggle('on-doctor', parts[0] === 'doctor');
    switch (parts[0]) {
      case '': viewHome(); break;
      case 'zone': viewZone(id); break;
      case 'symptom': viewSymptom(id); break;
      case 'card': viewCard(id); break;
      case 'doctor': viewDoctor(); break;
      case 'rules': viewRules(); break;
      case 'settings': viewSettings(); break;
      default: viewNotFound();
    }
    if (parts[0] !== '') window.scrollTo(0, 0);
  }

  app.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest) {
      var z = t.closest('[data-zone]');
      if (z) { location.hash = '#/zone/' + z.getAttribute('data-zone'); return; }
      var tab = t.closest('[data-tab]');
      if (tab) { homeTab = tab.getAttribute('data-tab'); renderHomeBody(); }
    }
  });

  function getJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': ' + r.status);
      return r.json();
    });
  }

  Promise.all([getJson('data/cards.json'), getJson('data/doctor.json')]).then(function (res) {
    DATA = res[0]; DOCTOR = res[1];
    DATA.cards.forEach(function (c) { cardById[c.id] = c; });
    buildIndex();
    window.addEventListener('hashchange', route);
    route();
    warmCache();
  }).catch(function (err) {
    app.innerHTML = '<p class="err-msg">Не удалось загрузить данные. Для первой загрузки нужен интернет.<br><small>' +
      esc(err.message) + '</small></p>';
  });

  // После обновления данных один раз подтягиваем все схемы, чтобы новые карточки
  // открывались без сети, даже если их ещё не смотрели.
  function warmCache() {
    if (!('serviceWorker' in navigator) || !navigator.onLine) return;
    var key = 'tochki_warm', want = DATA.version + '/' + DATA.cards.length;
    try { if (localStorage.getItem(key) === want) return; } catch (e) { return; }
    navigator.serviceWorker.ready.then(function () {
      return Promise.all(DATA.cards.map(function (c) { return c.svg ? fetch(c.svg) : null; }));
    }).then(function () {
      try { localStorage.setItem(key, want); } catch (e) { /* не страшно */ }
    }).catch(function () { /* попробуем при следующем запуске */ });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* офлайн-режим не включился */ });
    });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
})();
