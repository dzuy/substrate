import { readFileSync } from 'node:fs';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const errors = [];
for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_REPORT_API_URL', 'EXPO_PUBLIC_TATE_API_URL', 'EXPO_PUBLIC_DAILY_DRAFT_API_URL', 'EXPO_PUBLIC_SUPPLEMENT_LABEL_API_URL']) {
  try {
    const url = new URL(process.env[name]);
    if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) throw new Error();
    console.log(`${name}: ${url.origin}${url.pathname}`);
  } catch {
    errors.push(`${name} must be a configured public HTTPS endpoint without embedded credentials.`);
  }
}
if (!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) errors.push('Missing Supabase publishable key.');
if (!app.ios?.bundleIdentifier || !app.ios?.buildNumber || !app.ios?.appleTeamId) errors.push('Missing iOS identity, team or build number.');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`iOS preflight passed: ${app.ios.bundleIdentifier}, build ${app.ios.buildNumber}.`);
}
