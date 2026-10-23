import {createJourneyStore} from '../../shared/journey-sync.mjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ProfileContext, CheckInResponses } from '@/types/database';
import type { SkinReport, ScanResult, ReportAnswers } from '@/report/types';
export type {JourneyConflict} from '../../shared/journey-sync.mjs';
export type Journey = {
    version: 1;
    stage: string;
    revision: number;
    cloudRevision?: number;
    profileStep?: number;
    updatedAt: string;
    acknowledged?: boolean;
    profileDraft?: ProfileContext;
    baselineRefs?: { front?: string; left?: string; right?: string };
    photos?: {
        front?: string;
        left?: string;
        right?: string;
    };
    scan?: ScanResult;
    answers?: ReportAnswers;
    report?: SkinReport;
    simulation?: {
        price: 19.99;
        currency: 'USD';
        cadence: 'month';
        confirmedAt: string;
        mode: 'simulation';
    };
    wellness?: 'manual' | 'skip';
    wellnessDraft?: CheckInResponses;
    completedAt?: string;
};
const store=createJourneyStore({storage:AsyncStorage,remote:{
 async read(id:string){return (supabase as SupabaseClient).from('app_journey_state').select('payload,revision').eq('user_id',id).maybeSingle();},
 async write(_id:string,revision:number,payload:Journey){const result=await (supabase as SupabaseClient).rpc('save_app_journey',{expected_revision:revision,new_payload:payload});return {error:result.error};}
}});
export const loadJourney=store.load;
export const saveJourney=store.save;
export const resolveJourney=store.resolve;
