import { projectCatalogProduct } from '../../../shared/catalog-matching.mjs';
export const emptyCatalog = (version='database-unavailable') => ({version,region:'unspecified',verifiedAt:'',products:[]});

export async function loadDatabaseCatalog(env,fetcher=fetch,authorization) {
 const url=env.EXPO_PUBLIC_SUPABASE_URL;
 const key=env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!/^Bearer [A-Za-z0-9._-]+$/.test(authorization??''))return emptyCatalog('sign-in-required');
 try {
  // Preserve reviewed expressions and citations where they exist, without using
  // publication approval to restrict the universe of products considered.
  const reviewedResponse = await fetcher(new URL('/rest/v1/rpc/get_recommendation_catalog',url), {
   method:'POST',headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)
  });
  if(!reviewedResponse.ok)throw Error('Reviewed catalog unavailable');
  const reviewed=await reviewedResponse.json();
  const byId=new Map((reviewed.products || []).map(p=>[p.id,p]));
  const products=[];
  const pageSize=200;
  for(let offset=0;;offset+=pageSize) {
   const endpoint=new URL('/rest/v1/products',url);
   endpoint.searchParams.set('select','id,name,category,updated_at,formula_status,product_type,is_bundle,brand:brands(name),product_ingredients(ingredient:ingredients(name,inci_name))');
   endpoint.searchParams.set('archived_at','is.null');
   endpoint.searchParams.set('order','id.asc');
   endpoint.searchParams.set('offset',String(offset));
   endpoint.searchParams.set('limit',String(pageSize));
   const response=await fetcher(endpoint,{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Catalog page unavailable');
   const page=await response.json();
   if(!Array.isArray(page))throw Error('Invalid catalog page');
   products.push(...page.map(row=>({...projectCatalogProduct(row),...byId.get(row.id)})));
   if(page.length<pageSize)break;
  }
  const version='full-catalog-v1:'+products.length+':'+products.reduce((v,p)=>p.updatedAt>v?p.updatedAt:v,'');
  return {version,region:'unspecified',verifiedAt:'',products};
 } catch { return emptyCatalog(); }
}
