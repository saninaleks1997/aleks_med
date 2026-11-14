/* Общий силуэт тела: один и тот же контур используется
   - на главном экране (кликабельные зоны),
   - в схемах карточек (tools/build-svg.js генерирует файлы svg/*.svg).
   Координаты: поле 240 x 460, ось тела x = 120. Точки заданы как [dx, y],
   где dx — отступ от оси вправо (левая половина получается зеркально). */
(function (root) {
  'use strict';
  var CX = 120;

  // Сглаженная замкнутая/открытая кривая через точки (Catmull-Rom -> Bezier)
  function spline(pts, closed) {
    var n = pts.length, d = '', i;
    function p(k) {
      if (closed) return pts[(k + n) % n];
      return pts[Math.max(0, Math.min(n - 1, k))];
    }
    function f(v) { return Math.round(v * 10) / 10; }
    d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    var last = closed ? n : n - 1;
    for (i = 0; i < last; i++) {
      var p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + f(c1[0]) + ' ' + f(c1[1]) + ' ' + f(c2[0]) + ' ' + f(c2[1]) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + (closed ? 'Z' : '');
  }

  // [dx,y] -> абсолютные координаты; side = 1 (правая половина рисунка) или -1 (левая)
  function abs(pts, side) {
    return pts.map(function (q) { return [CX + side * q[0], q[1]]; });
  }
  function shape(pts, side) { return spline(abs(pts, side), true); }
  function line(pts, side) { return spline(abs(pts, side), false); }

  // Половина контура «голова + туловище + нога» сверху вниз и обратно по внутренней стороне ноги
  var HALF = [
    [0, 10], [12, 13], [19, 25], [20, 40], [16, 54], [10, 63],
    [10, 70], [12, 78], [24, 84], [38, 89], [45, 96],
    [42, 110], [40, 122], [38, 140], [35, 160], [33, 176],
    [35, 194], [40, 212], [43, 232], [42, 260], [38, 290],
    [33, 316], [31, 331], [32, 346], [36, 366], [34, 388],
    [27, 412], [23, 428], [25, 438], [31, 447], [25, 452],
    [12, 452], [10, 442], [12, 428], [12, 408], [10, 386],
    [9, 366], [11, 346], [11, 330], [8, 300], [5, 266], [0, 238]
  ];
  function torsoPath() {
    var right = abs(HALF, 1);
    var left = abs(HALF.slice(1, HALF.length - 1), -1).reverse();
    return spline(right.concat(left), true);
  }

  // Рука (одна сторона), ладонь у бедра
  var ARM = [
    [37, 89], [47, 91], [55, 100], [58, 116], [57, 136], [56, 154],
    [58, 166], [61, 182], [61, 202], [58, 222], [58, 232],
    [63, 242], [64, 250], [61, 252], [60, 262], [55, 270],
    [50, 262], [49, 244], [48, 230], [46, 208], [45, 188],
    [44, 170], [43, 152], [42, 132], [41, 116], [37, 102]
  ];
  function armPath(side) { return shape(ARM, side); }

  // Тонкие линии рельефа — только для ориентира
  var DETAIL = {
    front: [
      { both: [[10, 86], [22, 88], [36, 91]] },                         // ключица
      { both: [[4, 126], [16, 132], [30, 128], [39, 114]] },            // нижний край грудной мышцы
      { mid: [[0, 96], [0, 128]] },                                     // грудина
      { mid: [[0, 136], [0, 214]] },                                    // белая линия живота
      { both: [[2, 152], [10, 154], [16, 152]] },
      { both: [[2, 170], [10, 172], [16, 170]] },
      { both: [[2, 188], [10, 190], [15, 188]] },
      { both: [[17, 138], [19, 170], [16, 204]] },                      // край прямой мышцы живота
      { both: [[38, 204], [26, 220], [8, 236]] },                       // паховая складка
      { both: [[13, 322], [21, 318], [29, 322], [30, 334], [21, 341], [12, 334], [13, 322]] }, // надколенник
      { both: [[21, 341], [21, 352]] },                                 // связка надколенника
      { both: [[22, 356], [20, 390], [18, 424]] },                      // гребень большеберцовой кости
      { both: [[44, 158], [50, 162], [56, 158]] },                      // локтевой сгиб
      { both: [[49, 112], [52, 126], [50, 140]] }                       // бицепс
    ],
    back: [
      { mid: [[0, 70], [0, 226]] },                                     // позвоночник
      { both: [[14, 97], [26, 94], [41, 95]] },                         // ость лопатки
      { both: [[14, 97], [13, 118], [16, 138], [22, 148], [30, 136], [38, 114], [41, 95]] }, // лопатка
      { both: [[3, 196], [14, 200], [30, 196]] },                       // гребень таза
      { both: [[0, 226], [6, 248], [22, 258], [38, 252]] },             // ягодичная складка
      { both: [[13, 330], [21, 333], [30, 330]] },                      // подколенная складка
      { both: [[18, 398], [17, 428]] },                                 // ахилл
      { both: [[47, 156], [50, 152], [53, 156], [50, 161], [47, 156]] } // локтевой отросток
    ]
  };
  function detailPaths(view) {
    var out = [];
    DETAIL[view].forEach(function (it) {
      if (it.mid) out.push(line(it.mid, 1));
      if (it.both) { out.push(line(it.both, 1)); out.push(line(it.both, -1)); }
    });
    return out;
  }

  // Зоны главного экрана: полосы по высоте, обрезанные контуром туловища или руки.
  // t — «туловище», a — «рука»; [y1, y2]
  var ZONES = {
    front: [
      { id: 'head', on: 't', y: [0, 64] },
      { id: 'neck', on: 't', y: [64, 86] },
      { id: 'chest', on: 't', y: [86, 148] },
      { id: 'abdomen', on: 't', y: [148, 224] },
      { id: 'thigh_front', on: 't', y: [224, 314] },
      { id: 'knee', on: 't', y: [314, 350] },
      { id: 'shin', on: 't', y: [350, 426] },
      { id: 'foot', on: 't', y: [426, 460] },
      { id: 'shoulder', on: 'a', y: [80, 120] },
      { id: 'arm_front', on: 'a', y: [120, 150] },
      { id: 'elbow', on: 'a', y: [150, 174] },
      { id: 'forearm', on: 'a', y: [174, 226] },
      { id: 'hand', on: 'a', y: [226, 280] }
    ],
    back: [
      { id: 'head', on: 't', y: [0, 64] },
      { id: 'neck', on: 't', y: [64, 88] },
      { id: 'upper_back', on: 't', y: [88, 160] },
      { id: 'lower_back', on: 't', y: [160, 206] },
      { id: 'glutes', on: 't', y: [206, 256] },
      { id: 'thigh_back', on: 't', y: [256, 318] },
      { id: 'knee', on: 't', y: [318, 348] },
      { id: 'calf', on: 't', y: [348, 426] },
      { id: 'foot', on: 't', y: [426, 460] },
      { id: 'shoulder', on: 'a', y: [80, 120] },
      { id: 'arm_back', on: 'a', y: [120, 150] },
      { id: 'elbow', on: 'a', y: [150, 174] },
      { id: 'forearm', on: 'a', y: [174, 226] },
      { id: 'hand', on: 'a', y: [226, 280] }
    ]
  };

  var ZONE_NAMES = {
    head: 'Голова', neck: 'Шея', shoulder: 'Плечевой сустав', chest: 'Грудь',
    abdomen: 'Живот', upper_back: 'Между лопаток', lower_back: 'Поясница',
    glutes: 'Ягодицы', arm_front: 'Плечо спереди (бицепс)', arm_back: 'Плечо сзади (трицепс)',
    elbow: 'Локоть', forearm: 'Предплечье', hand: 'Кисть',
    thigh_front: 'Бедро спереди (квадрицепс)', thigh_back: 'Бедро сзади',
    knee: 'Колено', shin: 'Голень спереди', calf: 'Икры', foot: 'Стопа'
  };

  // Разметка силуэта (без зон) — общая для главного экрана и схем карточек
  function silhouette(view, o) {
    o = o || {};
    var fill = o.fill || '#eef1f4', stroke = o.stroke || '#7b8794', det = o.detail || '#a9b3bd';
    var sw = o.strokeWidth || 1.2;
    var s = '<g fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round">' +
      '<path d="' + armPath(1) + '"/><path d="' + armPath(-1) + '"/>' +
      '<path d="' + torsoPath() + '"/></g>' +
      '<g fill="none" stroke="' + det + '" stroke-width="' + (sw * 0.7) + '" stroke-linecap="round">';
    detailPaths(view).forEach(function (d) { s += '<path d="' + d + '"/>'; });
    return s + '</g>';
  }

  var api = {
    CX: CX, spline: spline, abs: abs, shape: shape, line: line,
    torsoPath: torsoPath, armPath: armPath, detailPaths: detailPaths,
    silhouette: silhouette, ZONES: ZONES, ZONE_NAMES: ZONE_NAMES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Body = api;
})(typeof self !== 'undefined' ? self : this);
