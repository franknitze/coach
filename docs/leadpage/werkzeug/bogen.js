// Kontaktbogen: alle Fotos verkleinert auf einer Seite, zum Durchsehen.
const fs = require('fs'), os = require('os'), path = require('path');
const cache = path.join(os.homedir(), '.npm', '_npx');
const pw = fs.readdirSync(cache).map(d => path.join(cache, d, 'node_modules', 'playwright'))
  .filter(p => fs.existsSync(p)).map(p => ({ v: require(p + '/package.json').version, p }))
  .sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }))[0];
const { chromium } = require(pw.p);
const dir = path.resolve(process.argv[2]), aus = process.argv[3];
const fotos = fs.readdirSync(dir).filter(f => /\.png$/.test(f)).sort();
const html = '<body style="margin:0;background:#fff;display:flex;flex-wrap:wrap;gap:8px;width:2400px;font:14px sans-serif">' + fotos.map(f => `<figure style="margin:0;width:390px"><img src="file://${dir}/${f}" style="width:390px"><figcaption>${f}</figcaption></figure>`).join('') + '</body>';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 2400, height: 900 } });
  fs.writeFileSync('/tmp/bogen.html', html);
  await p.goto('file:///tmp/bogen.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: aus, fullPage: true }); await b.close();
})();
