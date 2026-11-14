#!/usr/bin/env node
/* Делает PNG-иконки из icons/icon.svg (нужен Playwright; запускать только при смене иконки). */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const dir = path.join(__dirname, '..', 'icons');
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
  const b = await chromium.launch();
  for (const size of [180, 192, 512]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await p.screenshot({ path: path.join(dir, `icon-${size}.png`) });
    await p.close();
  }
  await b.close();
})();
