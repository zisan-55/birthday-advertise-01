import { build } from 'esbuild';
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imageExtension = /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i;
const musicExtension = /\.(mp3|wav|ogg|m4a|aac)$/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function loadConfiguration(override) {
  const clientPath = resolve(root, 'src/config/client.json');
  const result = await build({
    stdin: { contents: 'export { birthdayConfig, buildBirthdayConfig, CLIENT_ARTWORK_MODE } from "./src/config/birthdayConfig"; export { validateBirthdayConfig } from "./src/lib/validateConfig"; export { getCountdown } from "./src/lib/time"; export * from "./src/lib/distributePhotos";', resolveDir: root },
    bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env.BASE_URL': '"./"' },
    plugins: override ? [{ name: 'test-client', setup(b) { b.onLoad({ filter: /client\.json$/ }, args => args.path === clientPath ? { contents: JSON.stringify(override), loader: 'json' } : undefined); } }] : [],
  });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function localAsset(src, label, extension, errors) {
  if (typeof src !== 'string' || !/^\/?(?!\/)[\w./ -]+$/.test(src) || src.split('/').some(p => p === '..' || p === '.') || !extension.test(src)) {
    errors.push(`${label} must be a local public asset path with a supported extension.`); return null;
  }
  try {
    const publicRoot = realpathSync(resolve(root, 'public'));
    const file = realpathSync(resolve(publicRoot, src.replace(/^\//, '')));
    const rel = relative(publicRoot, file);
    if (rel.startsWith('..') || isAbsolute(rel) || !statSync(file).isFile() || statSync(file).size === 0) throw new Error();
    return file;
  } catch { errors.push(`${label}: missing, empty or unsafe file: ${src}`); return null; }
}
export function validateClient(client, getCountdown) {
  const errors = [];
  if (!plainObject(client)) return ['Client information must be a JSON object.'];
  const required = (value, label) => { if (typeof value !== 'string' || !value.trim() || /[<>]/.test(value)) errors.push(`${label} must be a nonempty string without placeholder brackets.`); };
  required(client.siteId, 'siteId');
  if (typeof client.siteId !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(client.siteId)) errors.push('siteId must be 3–80 lowercase letters, numbers or hyphens and unique per site.');
  const recipient = plainObject(client.recipient) ? client.recipient : {};
  required(recipient.name, 'recipient.name'); required(recipient.nickname, 'recipient.nickname'); required(client.sender?.name, 'sender.name');
  if (!Number.isInteger(recipient.age) || recipient.age < 1 || recipient.age > 150) errors.push('recipient.age must be an integer from 1 to 150.');
  if (typeof recipient.birthdayDate !== 'string' || typeof recipient.birthdayTime !== 'string' || typeof recipient.timezone !== 'string' || !getCountdown(recipient.birthdayDate, recipient.birthdayTime, recipient.timezone).valid) errors.push('Birthday date, time or IANA timezone is invalid.');
  if (![10, 15, 20].includes(client.photoPackage)) errors.push('photoPackage must be exactly 10, 15 or 20.');
  const photos = plainObject(client.photos) ? client.photos : {};
  if (!plainObject(client.photos)) errors.push('photos must be an object with regular and couple arrays; the old flat photo list is no longer supported.');
  for (const key of Object.keys(photos)) if (!['regular', 'couple'].includes(key)) errors.push('Unknown photo category: ' + key);
  for (const category of ['regular', 'couple']) if (!Array.isArray(photos[category])) errors.push(`photos.${category} must be an array (use [] when empty).`);
  const regular = Array.isArray(photos.regular) ? photos.regular : [];
  const couple = Array.isArray(photos.couple) ? photos.couple : [];
  if (regular.length + couple.length !== client.photoPackage) errors.push(`Regular Photos (${regular.length}) + Couple Photos (${couple.length}) must equal photoPackage (${client.photoPackage}); couple photos count within the package.`);
  const paths = new Set(), fingerprints = new Set();
  for (const category of ['regular', 'couple']) (Array.isArray(photos[category]) ? photos[category] : []).forEach((photo, i) => {
    const label = `photos.${category}[${i}]`;
    if (!plainObject(photo)) { errors.push(label + ' must be a photo object.'); return; }
    const file = localAsset(photo.src, label + '.src', imageExtension, errors);
    if (file) {
      const key = process.platform === 'win32' ? file.toLowerCase() : file;
      if (paths.has(key)) errors.push(label + ' duplicates a photo path in Regular/Couple Photos.');
      const fingerprint = hash(readFileSync(file));
      if (fingerprints.has(fingerprint) && !paths.has(key)) errors.push(label + ' duplicates the file content of another photo; supply unique photos.');
      paths.add(key); fingerprints.add(fingerprint);
    }
    for (const field of ['alt', 'caption']) if (photo[field] != null) required(photo[field], `${label}.${field}`);
  });
  for (const [section, allowed] of [['messages', ['reveal', 'introduction', 'closing', 'signature']], ['music', ['src', 'title', 'artwork']]]) {
    if (!plainObject(client[section])) { errors.push(section + ' must be an object.'); continue; }
    for (const [key, value] of Object.entries(client[section])) {
      if (!allowed.includes(key)) errors.push(`Unknown ${section} field: ${key}`);
      if (value != null) required(value, `${section}.${key}`);
    }
  }
  if (plainObject(client.music)) {
    if (client.music.src != null) { localAsset(client.music.src, 'music.src', musicExtension, errors); required(client.music.title, 'music.title'); }
    else localAsset('/audio/birthday-song.mp3', 'default music', musicExtension, errors);
    if (client.music.artwork != null) localAsset(client.music.artwork, 'music.artwork', imageExtension, errors);
  }
  localAsset('/images/hero-dusk.svg', 'reveal background', imageExtension, errors);
  if (!Array.isArray(client.scrapbookNotes) || client.scrapbookNotes.length !== 8) errors.push('scrapbookNotes must contain 8 entries.');
  else client.scrapbookNotes.forEach((notes, i) => { if (notes !== null) { if (!Array.isArray(notes) || notes.length !== 2) errors.push(`scrapbookNotes[${i}] requires exactly two notes or null.`); else notes.forEach((note, j) => required(note, `scrapbookNotes[${i}][${j}]`)); } });
  return errors;
}
export function validateEffectiveAssets(config) {
  const errors = [];
  for (const [label, src, ext] of [
    ...config.photoCarousel.photos.map((p,i) => [`carousel[${i}]`, p.src, imageExtension]),
    ...config.gallery.photos.map((p,i) => [`memories[${i}]`, p.src, imageExtension]),
    ...config.scrapbook.pages.flatMap((p,i) => p.photos.map((v,j) => [`scrapbook[${i}][${j}]`, v.src, imageExtension])),
    ...config.photoUniverse.photos.map((p,i) => [`universe[${i}]`, p.src, imageExtension]),
    ['music player artwork', config.audio.artwork, imageExtension], ['music', config.audio.src, musicExtension],
  ]) localAsset(src.startsWith('./') ? src.slice(2) : src, label, ext, errors);
  return errors;
}
export async function check(clientFile = resolve(root, 'src/config/client.json')) {
  const client = JSON.parse(readFileSync(clientFile, 'utf8').replace(/^\uFEFF/, ''));
  // Validate schema and files before evaluating configuration that consumes them.
  const timeBundle = await build({ entryPoints: [resolve(root, 'src/lib/time.ts')], bundle: true, write: false, format: 'esm', platform: 'node' });
  const { getCountdown } = await import('data:text/javascript;base64,' + Buffer.from(timeBundle.outputFiles[0].text).toString('base64'));
  const errors = validateClient(client, getCountdown);
  if (errors.length) throw new Error('Client validation failed:\n- ' + errors.join('\n- '));
  const loaded = await loadConfiguration(client);
  const config = loaded.birthdayConfig;
  const warnings = [...loaded.validateBirthdayConfig(config), ...validateEffectiveAssets(config)];
  if (warnings.length) throw new Error('Configuration validation failed:\n- ' + warnings.join('\n- '));
  console.log(`Client validation passed: ${client.siteId}; package ${client.photoPackage}, regular ${client.photos.regular.length}, couple ${client.photos.couple.length}.`);
  return loaded;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) check(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
