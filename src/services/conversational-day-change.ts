import {supabase} from '@/lib/supabase';
import {getOrCreateDailyEntry} from '@/services/daily-entries';
import {prepareDayWithTate,confirmDayWithTate} from '@/services/tate-day';
import {localDate} from '../../shared/journey.mjs';
import {isDayChangeRequest,currentDayActivities,directActivityChange,validateActivityChange} from '../../shared/conversational-day-change.mjs';
export async function applyConversationalDayChange(text:string,signal:AbortSignal,reference?:string){
 if(!isDayChangeRequest(text))throw Error('Please describe the activity change you want.');
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('Sign in again to update your day.');
 const userId=data.session.user.id,date=localDate();
 const entry=await getOrCreateDailyEntry(userId,date);if(entry.error||!entry.data)throw Error('Could not load your saved day. Nothing was changed.');
 const current=currentDayActivities(entry.data.check_in);
 const direct=directActivityChange(text,current);
 const proposal=direct ? {userId,date,entry:entry.data,checkIn:entry.data.check_in,activities:direct} : await prepareDayWithTate(text,true,signal,reference);
 if(!proposal)throw Error('I could not identify a clear activity change. Nothing was changed.');
 const activities=direct || validateActivityChange(text,current,proposal.activities);
 if(signal.aborted)throw Error('The request was cancelled. Nothing was changed.');
 return confirmDayWithTate(proposal,activities.join('\n'),true);
}
