import {supabase} from '@/lib/supabase';
import {getLatestRecommendation} from '@/services/recommendations';
import {localDate} from '../../shared/journey.mjs';
import {routineContext} from '../../shared/tate-routine-context.mjs';
export async function loadTateRoutineContext(){
 const {data}=await supabase.auth.getSession();
 if(!data.session)throw Error('Sign in again to load your routine.');
 const result=await supabase.from('daily_entries').select('*').eq('user_id',data.session.user.id).eq('entry_date',localDate()).maybeSingle();
 if(result.error)throw Error('Could not load today’s saved routine. Please retry.');
 const recommendation=result.data?await getLatestRecommendation(data.session.user.id,result.data.id):{data:null,error:null};
 if(recommendation.error)throw Error('Could not load today’s saved routine. Please retry.');
 return routineContext(result.data,recommendation.data);
}
