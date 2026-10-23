import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyDraftHandler } from './daily-draft.mjs';
const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://test.example', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test', OPENAI_API_KEY: 'test' };
async function invoke({ headers = { authorization: 'Bearer test', host: 'app.example' }, body = { note: 'I slept poorly' }, fetcher = () => { throw Error('Unexpected network'); }, method = 'POST' } = {}) { let status, data; await createDailyDraftHandler({ env, fetcher })({ method, headers, body }, { writeHead(s) { status = s; }, end(v) { data = JSON.parse(v); } }); return { status, data }; }
test('daily draft rejects unauthenticated and cross-origin calls before provider access', async () => { assert.equal((await invoke({ headers: {} })).status, 401); assert.equal((await invoke({ headers: { authorization: 'Bearer test', host: 'app.example', origin: 'https://evil.example' } })).status, 403); assert.equal((await invoke({ method: 'GET' })).status, 405); });
test('daily drafting authenticates first and makes no database write', async () => { const calls = []; const r = await invoke({ fetcher: async (url, opts) => { calls.push({ url, opts }); return new Response(JSON.stringify(url.includes('/auth/') ? { id: 'owner' } : { output: [{ content: [{ type: 'output_text', text: JSON.stringify({ sleepQuality: 'Poor', cyclePhase: null, movementPlan: [] }) }] }] }), { status: 200 }); } }); assert.equal(r.status, 200); assert.equal(r.data.draft.sleepQuality, 'Poor'); assert.equal(r.data.draft.cyclePhase, undefined); assert.equal(calls.length, 2); assert.ok(calls.every(c => !c.url.includes('/rest/'))); assert.equal(JSON.parse(calls[1].opts.body).store, false); });
test('provider failure and invalid draft do not expose secrets', async () => { const r = await invoke({ fetcher: async (url) => new Response(JSON.stringify(url.includes('/auth/') ? { id: 'owner' } : { output: [{ content: [{ type: 'output_text', text: '{"sleepQuality":"invented"}' }] }] }), { status: 200 }) }); assert.equal(r.status, 503); assert.ok(!JSON.stringify(r).includes('OPENAI_API_KEY')); });

test('reviewed activities preserve order and times through cleaning and display', async () => {
  const { cleanDailyDraft, savedDailyActivities } = await import('../shared/daily-draft.mjs');
  const activities = ['Work', 'Gym at 4 PM', 'Dinner with friends at 7:30 PM'];
  const draft = cleanDailyDraft({ dailyActivities: activities, movementPlan: ['Indoors'] });
  assert.deepEqual(savedDailyActivities(JSON.parse(JSON.stringify(draft))), activities);
  assert.deepEqual(savedDailyActivities({ movementPlanNote: 'Work, then dinner with friends' }), ['Work, then dinner with friends']);
  assert.deepEqual(savedDailyActivities({}), []);
  assert.deepEqual(savedDailyActivities(cleanDailyDraft({dailyActivities:[' ', 'Work', 'Work']})), ['Work']);
  assert.throws(() => cleanDailyDraft({ dailyActivities: [42] }), /Invalid daily activities/);
});

test('Tate draft returns individual activities for review without saving', async () => {
  const activities = ['Work', 'Gym at 4 PM', 'Dinner at 7 PM'];
  const result = await invoke({ body: { note: 'Working, gym at 4 PM and dinner at 7 PM.' }, fetcher: async url => new Response(JSON.stringify(url.includes('/auth/') ? { id: 'owner' } : { output: [{ content: [{ type: 'output_text', text: JSON.stringify({dailyActivities: activities}) }] }] }), {status:200}) });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.draft.dailyActivities, activities);
});

test('activity edits supply current plans and request a complete reviewable proposal', async () => {
  let providerBody;
  const result = await invoke({ body: { mode: 'edit-activities', note: 'Move gym to 5 PM', currentActivities: ['Work', 'Gym at 4 PM', 'Dinner at 7 PM'] }, fetcher: async (url, options) => {
    if (url.includes('/auth/')) return new Response(JSON.stringify({ id: 'owner' }));
    providerBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ dailyActivities: ['Work', 'Gym at 5 PM', 'Dinner at 7 PM'] }) }] }] }));
  } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.draft.dailyActivities, ['Work', 'Gym at 5 PM', 'Dinner at 7 PM']);
  assert.deepEqual(JSON.parse(providerBody.input).currentActivities, ['Work', 'Gym at 4 PM', 'Dinner at 7 PM']);
  assert.match(providerBody.instructions, /retaining unchanged activities/);
  assert.match(result.data.notice, /confirm before saving/);
});
