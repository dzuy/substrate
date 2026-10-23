import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyEntryRoute} from '../shared/daily-entry-route.mjs';
const date='2026-10-23';
test('new day and photo-only entries start with check-in',()=>{
 assert.equal(dailyEntryRoute({date,entry:null}),'/daily-check-in');
 assert.equal(dailyEntryRoute({date,entry:{entry_date:date,check_in:{}}}),'/daily-check-in');
});
test('confirmed today opens overview; yesterday does not',()=>{
 const check_in={journeyVersion:1,confirmedAt:'2026-10-23T12:00:00Z'};
 assert.equal(dailyEntryRoute({date,entry:{entry_date:date,check_in}}),'/your-day');
 assert.equal(dailyEntryRoute({date,entry:{entry_date:'2026-10-22',check_in}}),'/daily-check-in');
});
test('skip applies only to its calendar date, independently of observations',()=>{
 assert.equal(dailyEntryRoute({date,skippedDate:date}),'/your-day');
 assert.equal(dailyEntryRoute({date,skippedDate:'2026-10-22'}),'/daily-check-in');
});
