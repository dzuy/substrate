import http from 'node:http';
import {pathToFileURL} from 'node:url';
// Development only: fixed service, loopback listener, no credentials stored/logged.
export function createDailyDraftProxy({fetcher=fetch}={}) {
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin && !/^http:\/\/(localhost|127\.0\.0\.1):8081$/.test(origin)){res.writeHead(403);res.end();return;}
  if(!['/api/daily-draft','/api/ask-tate'].includes(req.url)){res.writeHead(404);res.end();return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Headers','authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(req.headers.authorization||'')){res.writeHead(401);res.end('{"error":"Sign in first"}');return;}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>(req.url==='/api/ask-tate'?50000:10000)){res.writeHead(413);res.end();return;}}
   // Authorization is forwarded only to the same configured production service.
   const result=await fetcher(`https://www.substrate-skin.com${req.url}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:req.headers.authorization},body,signal:AbortSignal.timeout(req.url==='/api/ask-tate'?175000:55000)});
   res.writeHead(result.status,{'Content-Type':'application/json'});res.end(await result.text());
  }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"The planning service could not be reached. Please retry."}');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){createDailyDraftProxy().listen(4318,'127.0.0.1',()=>console.log('Daily planning development proxy listening on 127.0.0.1:4318'));}
