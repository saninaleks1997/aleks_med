#!/usr/bin/env node
/* Генератор схем карточек: node tools/build-svg.js
   Берёт общий силуэт из js/body.js и рисует поверх него мышцу, точки и зону боли.
   Результат — готовые файлы svg/*.svg (они лежат в репозитории; приложению этот
   скрипт не нужен, запускать его надо только после правки схем).
   Координаты: [dx, y], dx — отступ от оси тела вправо на рисунке. */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('../js/body.js');
const OUT = path.join(__dirname, '..', 'svg');

const C = {
  muscle: '#7fb5d6', muscleLine: '#2f6f96', pain: '#e53e3e', point: '#111827',
  text: '#374151', leader: '#9ca3af', ghost: '#5b7f97'
};
const r1 = v => Math.round(v * 10) / 10;

function svgOpen(crop, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.join(' ')}" role="img">` +
    `<title>${title}</title>` +
    `<defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="3" height="3" fill="${C.pain}" fill-opacity=".16"/><line x1="0" y1="0" x2="0" y2="3" stroke="${C.pain}" stroke-width="1" stroke-opacity=".5"/></pattern></defs>` +
    `<rect x="${crop[0]}" y="${crop[1]}" width="${crop[2]}" height="${crop[3]}" fill="#ffffff"/>`;
}
function pain(shape) {
  return `<path d="${shape}" fill="url(#hatch)" stroke="${C.pain}" stroke-width=".5" stroke-dasharray="1.6 1.2"/>`;
}
function muscle(shape, opt) {
  opt = opt || {};
  if (opt.ghost) return `<path d="${shape}" fill="none" stroke="${C.ghost}" stroke-width=".5" stroke-dasharray="2 1.3"/>`;
  return `<path d="${shape}" fill="${C.muscle}" fill-opacity="${opt.opacity || 0.72}" stroke="${C.muscleLine}" stroke-width=".7" stroke-linejoin="round"/>`;
}
function fibers(lines) {
  return `<g fill="none" stroke="${C.muscleLine}" stroke-width=".3" stroke-opacity=".7" stroke-linecap="round">` +
    lines.map(d => `<path d="${d}"/>`).join('') + '</g>';
}
function marker(x, y, n, r) {
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${C.point}" stroke="#fff" stroke-width="${r1(r * 0.22)}"/>` +
    `<text x="${r1(x)}" y="${r1(y + r * 0.38)}" font-size="${r1(r * 1.25)}" font-weight="700" text-anchor="middle" fill="#fff" font-family="Helvetica,Arial,sans-serif">${n}</text>`;
}
function label(fs_, from, to, text, anchor) {
  anchor = anchor || (to[0] < from[0] ? 'end' : 'start');
  const pad = anchor === 'start' ? 1 : anchor === 'end' ? -1 : 0;
  return `<line x1="${r1(from[0])}" y1="${r1(from[1])}" x2="${r1(to[0])}" y2="${r1(to[1])}" stroke="${C.leader}" stroke-width=".3"/>` +
    `<circle cx="${r1(from[0])}" cy="${r1(from[1])}" r=".6" fill="${C.leader}"/>` +
    `<text x="${r1(to[0] + pad)}" y="${r1(to[1] + fs_ * 0.35)}" font-size="${fs_}" text-anchor="${anchor}" fill="${C.text}" font-family="Helvetica,Arial,sans-serif" ` +
    `stroke="#fff" stroke-width="${r1(fs_ * 0.25)}" paint-order="stroke" stroke-linejoin="round">${text}</text>`;
}
// маленький силуэт целиком с рамкой показанного участка
function inset(view, crop, corner) {
  const h = crop[3] * 0.4, w = h * 150 / 460, m = crop[2] * 0.03;
  const x = corner.indexOf('l') >= 0 ? crop[0] + m : crop[0] + crop[2] - w - m;
  const y = corner.indexOf('t') >= 0 ? crop[1] + m : crop[1] + crop[3] - h - m;
  return `<svg x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" viewBox="45 0 150 460">` +
    `<rect x="45" y="0" width="150" height="460" rx="8" fill="#f8fafc" stroke="#d1d5db" stroke-width="2"/>` +
    B.silhouette(view, { strokeWidth: 2.2 }) +
    `<rect x="${crop[0]}" y="${crop[1]}" width="${crop[2]}" height="${crop[3]}" fill="${C.pain}" fill-opacity=".18" stroke="${C.pain}" stroke-width="3"/></svg>`;
}

const P = (pts, side) => B.shape(pts, side || 1);
const L = (pts, side) => B.line(pts, side || 1);
const X = dx => B.CX + dx;

function build(def) {
  const crop = def.crop, fsz = r1(crop[2] / 26), mr = r1(crop[2] / 30);
  let s = svgOpen(crop, def.title) + B.silhouette(def.view, { strokeWidth: crop[2] / 90 });
  (def.pain || []).forEach(p => { s += pain(P(p)); });
  (def.ghost || []).forEach(p => { s += muscle(P(p), { ghost: true }); });
  (def.muscles || []).forEach(p => { s += muscle(P(p)); });
  if (def.fibers) s += fibers(def.fibers.map(f => L(f)));
  (def.painTop || []).forEach(p => { s += pain(P(p)); });
  (def.labels || []).forEach(l => { s += label(fsz, [X(l.at[0]), l.at[1]], [X(l.to[0]), l.to[1]], l.text, l.anchor); });
  (def.points || []).forEach(p => { s += marker(X(p[0]), p[1], p[2], mr); });
  s += inset(def.view, crop, def.inset || 'rb') + '</svg>\n';
  fs.writeFileSync(path.join(OUT, def.file), s);
}

/* ---------------- схемы на общем силуэте ---------------- */
const defs = [
  {
    file: 'rhomboids.svg', title: 'Ромбовидные мышцы', view: 'back', crop: [96, 58, 88, 108], inset: 'lb',
    pain: [[[4, 88], [17, 93], [20, 118], [18, 144], [6, 140], [3, 114]]],
    muscles: [[[2, 80], [8, 88], [14, 98], [15, 118], [15, 138], [8, 128], [2, 116], [2, 98]]],
    fibers: [[[2, 86], [14, 104]], [[2, 94], [14, 113]], [[2, 102], [14.5, 122]], [[2, 110], [14.5, 131]]],
    points: [[9, 101, 1], [9, 116, 2], [10, 129, 3]],
    labels: [
      { at: [0, 72], to: [4, 63], text: 'позвоночник' },
      { at: [30, 94], to: [30, 70], text: 'ость лопатки' },
      { at: [13.5, 122], to: [26, 124], text: 'край лопатки' },
      { at: [22, 148], to: [26, 158], text: 'нижний угол лопатки' }
    ]
  },
  {
    file: 'trapezius-middle.svg', title: 'Трапециевидная мышца, средняя часть', view: 'back', crop: [96, 58, 88, 108], inset: 'lb',
    pain: [[[2, 86], [10, 86], [15, 98], [14, 114], [6, 118], [2, 108]], [[38, 86], [46, 87], [49, 94], [44, 99], [37, 95]]],
    muscles: [[[1.5, 82], [14, 86], [28, 89], [41, 90], [43, 96], [30, 98], [16, 101], [1.5, 108]]],
    fibers: [[[2, 88], [40, 92]], [[2, 94], [41, 94]], [[2, 100], [30, 96.5]], [[2, 105], [16, 100]]],
    points: [[8, 97, 1], [29, 91.5, 2]],
    labels: [
      { at: [0, 78], to: [4, 64], text: 'выступающий позвонок' },
      { at: [26, 95.5], to: [22, 126], text: 'ость лопатки' },
      { at: [43, 92], to: [34, 75], text: 'верхушка плеча' }
    ]
  },
  {
    file: 'rectus-femoris.svg', title: 'Прямая мышца бедра', view: 'front', crop: [98, 196, 104, 164], inset: 'lb',
    pain: [[[9, 316], [21, 310], [33, 316], [35, 332], [30, 346], [21, 350], [11, 345], [8, 331]], [[16, 292], [27, 292], [30, 306], [21, 310], [13, 306]]],
    muscles: [[[27, 214], [31, 238], [31, 272], [27, 302], [22, 317], [18, 302], [17, 272], [19, 240], [23, 219]]],
    fibers: [[[25, 220], [23.5, 312]], [[28, 232], [26, 296]], [[21.5, 236], [20.5, 296]]],
    points: [[24.5, 240, 1], [23.5, 270, 2]],
    labels: [
      { at: [24, 221], to: [44, 206], text: 'паховая складка' },
      { at: [29, 330], to: [44, 326], text: 'чашечка' },
      { at: [31, 255], to: [47, 250], text: 'линия к чашечке' }
    ]
  },
  {
    file: 'vastus-medialis.svg', title: 'Медиальная широкая мышца бедра', view: 'front', crop: [98, 196, 104, 164], inset: 'lb',
    pain: [[[6, 314], [16, 308], [24, 316], [25, 334], [19, 346], [10, 344], [6, 330]], [[8, 280], [17, 278], [18, 300], [14, 310], [8, 304]]],
    ghost: [[[27, 214], [31, 238], [31, 272], [27, 302], [22, 317], [18, 302], [17, 272], [19, 240], [23, 219]]],
    muscles: [[[16, 250], [11, 266], [8, 286], [8, 304], [10, 318], [14, 324], [17, 318], [18, 298], [17.5, 272]]],
    fibers: [[[15, 256], [10, 300]], [[17, 276], [11, 314]], [[17.5, 296], [14, 321]]],
    points: [[12.5, 306, 1], [13, 272, 2]],
    labels: [
      { at: [24, 221], to: [44, 206], text: 'паховая складка' },
      { at: [29, 330], to: [44, 326], text: 'чашечка' },
      { at: [14, 321], to: [38, 345], text: 'её внутренний угол' },
      { at: [28, 280], to: [47, 276], text: 'прямая мышца' }
    ]
  },
  {
    file: 'vastus-lateralis.svg', title: 'Латеральная широкая мышца бедра', view: 'front', crop: [98, 196, 104, 164], inset: 'lb',
    pain: [[[33, 232], [43, 232], [43, 262], [39, 292], [35, 318], [34, 340], [27, 342], [27, 318], [31, 290], [33, 260]]],
    ghost: [[[27, 214], [31, 238], [31, 272], [27, 302], [22, 317], [18, 302], [17, 272], [19, 240], [23, 219]]],
    muscles: [[[37, 234], [41.5, 248], [41, 268], [38, 292], [33.5, 312], [29, 320], [26.5, 314], [30, 292], [32, 266], [32.5, 242]]],
    fibers: [[[37, 240], [29, 314]], [[40, 254], [32, 308]], [[34, 244], [28, 304]]],
    points: [[32, 303, 1], [36.5, 272, 2], [38.5, 248, 3]],
    labels: [
      { at: [43, 229], to: [50, 214], text: 'выступ таза' },
      { at: [29, 330], to: [44, 334], text: 'чашечка' },
      { at: [41.5, 262], to: [50, 258], text: 'шов брюк' }
    ]
  },
  {
    file: 'triceps.svg', title: 'Трёхглавая мышца плеча', view: 'back', crop: [138, 80, 66, 102], inset: 'lb',
    pain: [[[43, 96], [52, 95], [56, 104], [50, 110], [42, 106]], [[43, 150], [50, 146], [58, 150], [59, 162], [52, 168], [44, 163]], [[51, 170], [57, 172], [57, 190], [52, 190]]],
    muscles: [[[43, 110], [48, 105], [53, 104], [56.5, 116], [56.5, 134], [54.5, 147], [50, 153], [46, 148], [43.5, 134], [42.5, 120]]],
    fibers: [[[49, 107], [50, 140]], [[45, 112], [48.5, 146]], [[54.5, 110], [51.5, 146]]],
    points: [[45.5, 126, 1], [54, 122, 2], [50, 143, 3]],
    labels: [
      { at: [50, 157], to: [61, 162], text: 'остриё локтя' },
      { at: [41, 109], to: [37, 116], text: 'подмышка' },
      { at: [45, 93], to: [50, 84], text: 'верхушка плеча' }
    ]
  },
  {
    file: 'gastrocnemius.svg', title: 'Икроножная мышца', view: 'back', crop: [70, 312, 138, 148], inset: 'rb',
    pain: [[[10, 372], [15, 374], [16, 400], [15, 424], [12, 424], [10, 400]], [[13, 326], [22, 329], [31, 326], [31, 338], [22, 342], [13, 338]], [[10, 438], [18, 437], [19, 449], [11, 450]]],
    muscles: [
      [[20.5, 334], [14, 340], [10.5, 354], [10.5, 370], [14, 384], [20, 390], [21, 370], [21, 350]],
      [[22.5, 334], [29, 339], [33.5, 352], [34, 368], [30, 381], [22.5, 387], [22, 368], [22, 350]]
    ],
    fibers: [[[19, 338], [14, 380]], [[24, 338], [30, 378]], [[21.5, 392], [18.5, 436]], [[20.5, 392], [17.5, 436]]],
    points: [[14.5, 355, 1], [29.5, 355, 2]],
    labels: [
      { at: [26, 331], to: [38, 322], text: 'сгиб под коленом' },
      { at: [12, 368], to: [4, 364], text: 'внутренняя головка' },
      { at: [33, 372], to: [38, 378], text: 'наружная головка' },
      { at: [18.5, 420], to: [4, 414], text: 'ахилл' },
      { at: [14, 446], to: [4, 440], text: 'свод стопы' }
    ]
  },
  {
    file: 'soleus.svg', title: 'Камбаловидная мышца', view: 'back', crop: [70, 312, 138, 148], inset: 'rb',
    pain: [[[13, 404], [22, 404], [24, 428], [26, 446], [19, 452], [12, 446], [12, 426]], [[13, 344], [30, 344], [33, 364], [22, 372], [11, 364]]],
    muscles: [[[11, 356], [9.5, 376], [11, 396], [15, 412], [18.5, 420], [22, 412], [28.5, 398], [33.5, 380], [34.5, 360], [28, 350], [16, 350]]],
    ghost: [
      [[20.5, 334], [14, 340], [10.5, 354], [10.5, 370], [14, 384], [20, 390], [21, 370], [21, 350]],
      [[22.5, 334], [29, 339], [33.5, 352], [34, 368], [30, 381], [22.5, 387], [22, 368], [22, 350]]
    ],
    fibers: [[[13, 394], [18, 418]], [[28, 394], [20, 418]], [[19.5, 422], [18, 438]], [[18.5, 422], [17, 438]]],
    points: [[15.5, 399, 1], [30, 360, 2]],
    labels: [
      { at: [34, 341], to: [38, 328], text: 'костный бугорок' },
      { at: [18, 428], to: [4, 420], text: 'ахилл' },
      { at: [20, 446], to: [4, 446], text: 'пятка' },
      { at: [12, 366], to: [4, 350], text: 'икроножная (сверху)' }
    ]
  }
];
defs.forEach(build);

/* ---------------- подошва стопы: отдельный рисунок ---------------- */
(function plantar() {
  const sp = (pts, closed) => B.spline(pts, closed !== false);
  const el = (cx, cy, rx, ry, rot) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
  const crop = [4, 16, 216, 284];
  const sole = [[100, 288], [80, 281], [68, 260], [66, 232], [73, 200], [80, 168], [74, 136], [62, 110], [62, 86], [78, 72],
    [102, 68], [126, 74], [144, 88], [152, 112], [151, 146], [146, 184], [141, 222], [137, 256], [127, 279]];
  let s = svgOpen(crop, 'Мышцы подошвы стопы');
  s += `<g fill="#eef1f4" stroke="#7b8794" stroke-width="2" stroke-linejoin="round"><path d="${sp(sole)}"/>` +
    el(73, 50, 13, 18, -6) + el(99, 43, 9, 13) + el(117, 48, 8.5, 12, 6) + el(132, 57, 8, 11, 12) + el(145, 69, 7.5, 10, 18) + '</g>';
  // рельеф: пяточная подушка, подушечка под пальцами
  s += `<g fill="none" stroke="#a9b3bd" stroke-width="1.3" stroke-linecap="round">` +
    `<path d="${sp([[72, 236], [86, 228], [104, 226], [122, 229], [136, 238]], false)}"/>` +
    `<path d="${sp([[66, 112], [84, 104], [106, 102], [128, 106], [148, 118]], false)}"/></g>`;
  s += pain(sp([[70, 240], [84, 238], [90, 256], [84, 274], [72, 268], [66, 254]]));
  s += pain(sp([[88, 76], [112, 74], [134, 84], [136, 100], [112, 100], [90, 98]]));
  s += muscle(sp([[92, 234], [108, 232], [120, 236], [126, 200], [130, 158], [130, 122], [112, 110], [94, 112], [92, 150], [92, 196]]), { opacity: 0.55 });
  s += muscle(sp([[72, 250], [69, 228], [75, 198], [81, 168], [76, 138], [66, 112], [72, 106], [82, 128], [90, 162], [88, 198], [86, 228], [82, 252]]));
  s += fibers([sp([[100, 230], [98, 116]], false), sp([[110, 230], [112, 116]], false), sp([[118, 230], [124, 124]], false),
    sp([[77, 246], [80, 200], [85, 164], [74, 116]], false)]);
  const fz = 9;
  s += label(fz, [80, 180], [22, 176], 'мышца большого', 'start').replace('<circle', '<circle');
  s += `<text x="23" y="${176 + fz * 1.35}" font-size="${fz}" fill="${C.text}" font-family="Helvetica,Arial,sans-serif" stroke="#fff" stroke-width="2" paint-order="stroke">пальца</text>`;
  s += label(fz, [128, 170], [156, 176], 'сгибатель', 'start');
  s += `<text x="157" y="${176 + fz * 1.35}" font-size="${fz}" fill="${C.text}" font-family="Helvetica,Arial,sans-serif" stroke="#fff" stroke-width="2" paint-order="stroke">пальцев</text>`;
  s += label(fz, [124, 252], [150, 262], 'пяточная', 'start');
  s += `<text x="151" y="${262 + fz * 1.35}" font-size="${fz}" fill="${C.text}" font-family="Helvetica,Arial,sans-serif" stroke="#fff" stroke-width="2" paint-order="stroke">подушка</text>`;
  s += label(fz, [146, 110], [160, 124], 'подушечка', 'start');
  s += label(fz, [70, 34], [22, 26], 'большой палец', 'start');
  s += marker(79, 214, 1, 8) + marker(105, 196, 2, 8) + marker(101, 124, 3, 8);
  s += '</svg>\n';
  fs.writeFileSync(path.join(OUT, 'plantar.svg'), s);
})();

/* ---------------- иконка приложения ---------------- */
(function icon() {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0f766e"/>` +
    `<g transform="translate(76 46) scale(1.5 0.9)" opacity=".0"></g>` +
    `<svg x="121" y="56" width="270" height="400" viewBox="52 4 136 262">` +
    B.silhouette('back', { fill: '#e6fffb', stroke: '#0b4f4a', detail: '#7fbfb8', strokeWidth: 2 }) + `</svg>` +
    `<circle cx="293" cy="212" r="30" fill="#f59e0b" stroke="#fff" stroke-width="8"/>` +
    `<circle cx="293" cy="212" r="58" fill="none" stroke="#fff" stroke-width="6" stroke-opacity=".75"/></svg>\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'icons', 'icon.svg'), s);
})();
console.log('Готово: svg/*.svg, icons/icon.svg');
