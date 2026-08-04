import AsyncStorage from '@react-native-async-storage/async-storage';

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

  return supabase
    .from('daily_entries')
    .insert({ user_id: userId, entry_date: date, status: 'draft' })
    .select('*')
    .single();
}

export async function listDailyEntries(userId: string, limit = 20) {
  return supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(limit);
}

export async function saveDailyCheckIn(entryId: string, checkIn: CheckInResponses) {
  return supabase
    .from('daily_entries')
    .update({ check_in: checkIn, status: 'check_in_added' })
    .eq('id', entryId)
    .select('*')
    .single();
}

export async function getActiveEntryDate(userId: string) {
  const key = buildActiveEntryDateKey(userId);
  const storedDate = await AsyncStorage.getItem(key);

  if (storedDate && isEntryDate(storedDate)) {
    return storedDate;
  }

  const today = formatLocalDate(new Date());
  await AsyncStorage.setItem(key, today);
  return today;
}

export async function advanceActiveEntryDate(userId: string) {
  const activeDate = await getActiveEntryDate(userId);
  const nextDate = addDays(activeDate, 1);
  await AsyncStorage.setItem(buildActiveEntryDateKey(userId), nextDate);
  return nextDate;
}

export async function getActiveOrNextEntryDate(userId: string) {
  let activeDate = await getActiveEntryDate(userId);
  const entry = await getOrCreateDailyEntry(userId, activeDate);

  if (entry.error || !entry.data) {
    return { data: activeDate, error: entry.error };
  }

  if (entry.data.status === 'planned') {
    activeDate = addDays(activeDate, 1);
    await AsyncStorage.setItem(buildActiveEntryDateKey(userId), activeDate);
    return { data: activeDate, error: null };
  }

  return { data: activeDate, error: null };
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

function buildActiveEntryDateKey(userId: string) {
  return `substrate:${userId}:active-entry-date`;
}

function isEntryDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseEntryDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = parseEntryDate(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}
