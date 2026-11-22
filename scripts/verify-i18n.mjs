import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '..', 'src', 'i18n', 'locales');
const expectedLocales = ['en', 'es', 'pt', 'de', 'fr', 'ja', 'zh', 'ru'];

function flattenKeys(obj, prefix = '') {
  const keys = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of flattenKeys(v, fullKey)) {
        keys.set(ck, cv);
      }
    } else {
      keys.set(fullKey, v);
    }
  }
  return keys;
}

const enData = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const enKeys = flattenKeys(enData);
let hasError = false;

for (const code of expectedLocales) {
  const filePath = path.join(localesDir, `${code}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing locale file: ${code}.json`);
    hasError = true;
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const keys = flattenKeys(data);

  for (const [k, enVal] of enKeys) {
    if (!keys.has(k)) {
      console.error(`[${code}] Missing key: ${k}`);
      hasError = true;
    } else {
      const val = keys.get(k);
      if (typeof val !== 'string' || val.trim().length === 0) {
        console.error(`[${code}] Empty or non-string key: ${k}`);
        hasError = true;
      }
      if (typeof enVal === 'string' && enVal.includes('{count}') && !String(val).includes('{count}')) {
        console.error(`[${code}] Missing {count} placeholder in key: ${k}`);
        hasError = true;
      }
    }
  }

  for (const k of keys.keys()) {
    if (!enKeys.has(k)) {
      console.error(`[${code}] Extra key not in en.json: ${k}`);
      hasError = true;
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`[verify-i18n] PASS: ${expectedLocales.length} locales verified with ${enKeys.size} keys each (100% parity).`);
