// Generates every logo and icon file under assets/ from the brand font's own outlines.
//
// Glyphs are outlined straight from Google Sans Flex (fontkit, after wawoff2 unpacks the WOFF2)
// into plain SVG paths, and the PNGs are rasterized from those SVGs with sharp. Nothing depends
// on an installed font or a browser, so the output is byte-stable across machines, and an SVG
// favicon never renders as an empty box while a web font loads.
//
//   wordmark.svg / wordmark-white.svg   "Jiro" in navy / white, cropped to the ink
//   wordmark.json                       the same path for inline use (fill: currentColor)
//   mark.svg                            white "J" on a full-bleed navy square
//   favicon.svg, favicon.ico,           the mark on a rounded square, for browser tabs
//   favicon-16.png, favicon-32.png
//   apple-touch-icon.png, icon-192.png, full-bleed mark for home screens and PWAs: iOS and Android
//   icon-512.png                        round the corners themselves
//   og-image.png                        1200×630 link preview: wordmark and tagline on navy
//
// Regenerate with: npm run generate
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as fontkit from 'fontkit';
import sharp from 'sharp';
import wawoff2 from 'wawoff2';

const tokens = JSON.parse(await readFile(new URL('../tokens.json', import.meta.url), 'utf8'));
const hex = (channels) => {
	const [h, s, l] = channels.split(' ').map(parseFloat);
	const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
	const f = (n) => {
		const k = (n + h / 30) % 12;
		const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(c * 255)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};
const NAVY = hex(tokens.color.primary); // #00002C
const WHITE = '#FFFFFF';

// The wordmark weight: bold, as in the website header. Tracking matches Tailwind's
// `tracking-tight` (-0.025em).
const WEIGHT = 700;
const TRACKING = -0.025;
const TAGLINE = 'Småföretagarnas tillväxtpartner';

const FONT_FILE = new URL(
	'../node_modules/@fontsource-variable/google-sans-flex/files/google-sans-flex-latin-wght-normal.woff2',
	import.meta.url
);
const font = fontkit.create(Buffer.from(await wawoff2.decompress(await readFile(FONT_FILE))));
const OUT = new URL('../assets/', import.meta.url);
await mkdir(OUT, { recursive: true });
const out = (name) => new URL(name, OUT);

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 100) / 100));

/** Outline `text` at `weight` as one path in font units (y up), plus its ink bounding box. */
function outline(text, weight, tracking = 0) {
	const face = font.getVariation({ wght: weight });
	const run = face.layout(text);
	const commands = [];
	let x = 0;
	run.glyphs.forEach((glyph, i) => {
		commands.push(glyph.path.translate(x + run.positions[i].xOffset, run.positions[i].yOffset));
		x += run.positions[i].xAdvance + tracking * font.unitsPerEm;
	});
	const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
	for (const p of commands) {
		const b = p.bbox;
		if (!Number.isFinite(b.minX)) continue; // spaces have no ink
		box.minX = Math.min(box.minX, b.minX);
		box.minY = Math.min(box.minY, b.minY);
		box.maxX = Math.max(box.maxX, b.maxX);
		box.maxY = Math.max(box.maxY, b.maxY);
	}
	return { paths: commands, box };
}

/** The outline flipped to SVG's y-down space, origin at the ink box's top-left corner. */
function toSvgPath({ paths, box }) {
	return round(paths.map((p) => p.translate(-box.minX, -box.maxY).scale(1, -1).toSVG()).join(''));
}

// Wordmark, cropped to the ink. `heightEm` is the ink height per em of font size, so a
// component can size the SVG to match the text it replaces: height = heightEm × font-size.
const word = outline('Jiro', WEIGHT, TRACKING);
const wordW = Math.round(word.box.maxX - word.box.minX);
const wordH = Math.round(word.box.maxY - word.box.minY);
const wordD = toSvgPath(word);
const wordmarkSvg = (fill) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wordW} ${wordH}" role="img" aria-label="Jiro"><path fill="${fill}" d="${wordD}"/></svg>\n`;
await writeFile(out('wordmark.svg'), wordmarkSvg(NAVY));
await writeFile(out('wordmark-white.svg'), wordmarkSvg(WHITE));
await writeFile(
	out('wordmark.json'),
	JSON.stringify(
		{
			viewBox: `0 0 ${wordW} ${wordH}`,
			heightEm: Math.round((wordH / font.unitsPerEm) * 1000) / 1000,
			weight: WEIGHT,
			d: wordD
		},
		null,
		'\t'
	) + '\n'
);

// The "J" mark. 60% of the canvas tall keeps it legible in a 16px tab and inside the maskable
// safe zone (a circle of 40% radius) that Android crops icon-512 to.
const SIZE = 512;
const j = outline('J', WEIGHT);
const jScale = (SIZE * 0.6) / (j.box.maxY - j.box.minY);
const jW = (j.box.maxX - j.box.minX) * jScale;
const jH = (j.box.maxY - j.box.minY) * jScale;
const jPath = `<path transform="translate(${((SIZE - jW) / 2).toFixed(2)} ${((SIZE - jH) / 2).toFixed(2)}) scale(${jScale.toFixed(5)})" fill="${WHITE}" d="${toSvgPath(j)}"/>`;
const markSvg = (radius) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Jiro"><rect width="${SIZE}" height="${SIZE}"${radius ? ` rx="${radius}"` : ''} fill="${NAVY}"/>${jPath}</svg>\n`;
const mark = markSvg(0);
const favicon = markSvg(Math.round(SIZE * 0.22));
await writeFile(out('mark.svg'), mark);
await writeFile(out('favicon.svg'), favicon);

const png = (svg, size) =>
	sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / SIZE) * 4 })
		.resize(size, size)
		.png({ compressionLevel: 9 })
		.toBuffer();

for (const [name, size] of [
	['apple-touch-icon.png', 180],
	['icon-192.png', 192],
	['icon-512.png', 512]
]) {
	await writeFile(out(name), await png(mark, size));
}
const tabSizes = [16, 32, 48];
const tabPngs = await Promise.all(tabSizes.map((size) => png(favicon, size)));
await writeFile(out('favicon-16.png'), tabPngs[0]);
await writeFile(out('favicon-32.png'), tabPngs[1]);

// favicon.ico: an ICONDIR header plus one PNG-encoded entry per size (Vista+ ICO format).
const header = Buffer.alloc(6 + 16 * tabPngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(tabPngs.length, 4);
let offset = header.length;
tabPngs.forEach((data, i) => {
	const e = 6 + 16 * i;
	header.writeUInt8(tabSizes[i], e);
	header.writeUInt8(tabSizes[i], e + 1);
	header.writeUInt16LE(1, e + 4); // colour planes
	header.writeUInt16LE(32, e + 6); // bits per pixel
	header.writeUInt32LE(data.length, e + 8);
	header.writeUInt32LE(offset, e + 12);
	offset += data.length;
});
await writeFile(out('favicon.ico'), Buffer.concat([header, ...tabPngs]));

// Link preview: the wordmark at 40% of the width, the tagline below it in regular weight.
const OG_W = 1200;
const OG_H = 630;
const ogWordScale = (OG_W * 0.4) / wordW;
const tag = outline(TAGLINE, 400);
const tagW = tag.box.maxX - tag.box.minX;
const tagH = tag.box.maxY - tag.box.minY;
const tagScale = 34 / font.capHeight; // 34px cap height
const gap = 56;
const blockH = wordH * ogWordScale + gap + tagH * tagScale;
const top = (OG_H - blockH) / 2;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
<rect width="${OG_W}" height="${OG_H}" fill="${NAVY}"/>
<path transform="translate(${((OG_W - wordW * ogWordScale) / 2).toFixed(2)} ${top.toFixed(2)}) scale(${ogWordScale.toFixed(5)})" fill="${WHITE}" d="${wordD}"/>
<path transform="translate(${((OG_W - tagW * tagScale) / 2).toFixed(2)} ${(top + wordH * ogWordScale + gap).toFixed(2)}) scale(${tagScale.toFixed(5)})" fill="${WHITE}" fill-opacity="0.85" d="${toSvgPath(tag)}"/>
</svg>`;
await writeFile(
	out('og-image.png'),
	await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toBuffer()
);

console.log(`assets/ written (wordmark ${wordW}×${wordH} font units, weight ${WEIGHT}, navy ${NAVY})`);
