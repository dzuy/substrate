import { localDate } from '../../shared/journey.mjs';

import { supabase } from '@/lib/supabase';
import type { CheckInResponses } from '@/types/database';

type EntryDateInput = Date | string;

export async function getOrCreateDailyEntry(userId: string, entryDate: EntryDateInput = new Date()) {
  const date = formatEntryDate(entryDate);

  const existing = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .maybeSingle();

  if (existing.error) {
    return existing;
  }

  if (existing.data) {
    return existing;
  }

  const created = await supabase
    .from('daily_entries')
    .insert({ user_id: userId, entry_date: date, status: 'draft' })
    .select('*')
    .single();
  if(created.error?.code==='23505') return supabase.from('daily_entries').select('*').eq('user_id',userId).eq('entry_date',date).single();
  return created;
}

export async function listDailyEntries(userId: string, limit = 20) {
  return supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(limit);
}

export async function getPreviousDailyEntry(userId: string, currentEntryDate: string) {
  return supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .lt('entry_date', currentEntryDate)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function saveDailyCheckIn(entryId: string, checkIn: CheckInResponses) {
  return supabase
    .from('daily_entries')
    .update({ check_in: checkIn, status: 'check_in_added' })
    .eq('id', entryId)
    .select('*')
    .single();
}

// Keep old function names for existing routes; never advance or relabel historical records.
export async function getActiveEntryDate(_userId: string) { return localDate(); }
export async function advanceActiveEntryDate(_userId: string) { return localDate(); }
export async function getActiveOrNextEntryDate(userId: string) {
 const date=localDate(); const entry=await getOrCreateDailyEntry(userId,date);
 return {data:date,error:entry.error};
}

export function formatDisplayDate(date: string) {
  const parsed = parseEntryDate(date);

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatEntryDate(entryDate: EntryDateInput) {
  return typeof entryDate === 'string' ? entryDate : formatLocalDate(entryDate);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseEntryDate(value: string) { const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d); }
