export const emptyCatalog = (version='database-unavailable') => ({version,region:'unspecified',verifiedAt:'',products:[]});

/** Only the database's approved public projection enters matching. No demo fallback. */
export async function loadDatabaseCatalog(env,fetcher=fetch,authorization) {
 const url=env.EXPO_PUBLIC_SUPABASE_URL;
 const key=env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!/^Bearer [A-Za-z0-9._-]+$/.test(authorization??''))return emptyCatalog('sign-in-required');
 try {
  const response=await fetcher(new URL('/rest/v1/rpc/get_recommendation_catalog',url),{
   method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return emptyCatalog();
  const catalog=await response.json();
  if(!Array.isArray(catalog.products)||typeof catalog.version!=='string')return emptyCatalog();
  return catalog;
 } catch { return emptyCatalog(); }
}
