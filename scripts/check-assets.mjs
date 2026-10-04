import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';
const manifest = JSON.parse(await fs.readFile('assets/manifest.json', 'utf8'));
const approved = new Set(['svg','path','rect','circle','line','polyline','polygon','ellipse','defs','linearGradient','radialGradient','stop','g','text','tspan','filter','feTurbulence','feColorMatrix','feBlend','feGaussianBlur','feComposite']);
for (const asset of manifest.assets) {
  const data = await fs.readFile(asset.path);
  if (data.length > 40000) throw new Error(`Oversized SVG: ${asset.path}`);
  if (crypto.createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error(`Asset hash mismatch: ${asset.path}`);
  const dom = new JSDOM(data.toString('utf8'), { contentType: 'image/svg+xml' });
  const doc = dom.window.document;
  for (const node of doc.querySelectorAll('*')) {
    if (!approved.has(node.localName)) throw new Error(`Unexpected SVG element ${node.localName}`);
    for (const attr of node.attributes) {
      if (attr.name === 'xmlns') continue;
      if (/^on/i.test(attr.name) || /href$/i.test(attr.name) || /(?:https?:|data:|javascript:)/i.test(attr.value)) throw new Error(`Unsafe SVG attribute: ${asset.path}`);
      const match = attr.value.match(/url\((.*?)\)/);
      if (match && (!match[1].startsWith('#') || !doc.getElementById(match[1].slice(1)))) throw new Error(`Non-local SVG reference: ${asset.path}`);
    }
  }
  if (asset.path.includes('/icons/') && doc.documentElement.getAttribute('viewBox') !== '0 0 24 24') throw new Error('Icon canvas must be 24px.');
  dom.window.close();
}
console.log(`Validated ${manifest.assets.length} original SVG assets, local references and hashes.`);
