import { fail, readWorkspace } from "@/lib/store";
import { contentHash, openBlockers } from "@/lib/model";
import { env } from "cloudflare:workers";
import { zipSync, strToU8 } from "fflate";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
  const {key,w}=await readWorkspace(request);
  const params=new URL(request.url).searchParams;
  const c=w.campaigns.find(c=>c.id===params.get("id"));
  if(!c)throw new Error("NOT_FOUND: Campaign not found");
  if(c.status!=="Released"||!c.approval||c.approval.hash!==await contentHash(c)||c.approval.packVersion!==w.packVersion||openBlockers(c).length)throw new Error("This revision has not passed the release check");
  const offer=w.rules.find(r=>r.type==="offer"&&r.active);
  const allText=[c.text,...c.assets.map(a=>a.text)].join(" ");
  if(offer?.expires&&offer.expires<new Date().toISOString().slice(0,10)&&/\d+\s*%/.test(allText))throw new Error("The offer has expired; re-review is required");
  const receipt={product:"Accord",mode:"Fictional sandbox — personas are simulated",campaign:{id:c.id,title:c.title,channel:c.channel,audience:c.audience,purpose:c.purpose,text:c.text,revision:c.revision,assets:c.assets.map(({url,...a})=>a)},approval:c.approval,releasedAt:c.releasedAt,review:c.review,comments:c.comments,auditTrail:w.events.filter(e=>e.campaignId===c.id),brandPack:{version:w.packVersion,references:w.rules},exportedAt:new Date().toISOString()};
  const name=`accord-${c.id.slice(0,8)}-r${c.revision}`;
  if(params.get("format")==="json")return new Response(JSON.stringify(receipt,null,2),{headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","Content-Disposition":`attachment; filename="${name}.json"`}});
  const files:Record<string,Uint8Array>={"approved-copy.txt":strToU8(c.text),"review-receipt.json":strToU8(JSON.stringify(receipt,null,2))};
  for(const [index,a] of c.assets.entries()){
    const original=await env.BUCKET?.get(`${key}/${a.id}`);
    if(!original)throw new Error("An approved original is unavailable. Export cancelled; no incomplete package was released.");
    const safe=a.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,100)||"creative";
    files[`assets/${index+1}-${safe}`]=new Uint8Array(await original.arrayBuffer());
  }
  const archive=zipSync(files,{level:0});
  return new Response(archive,{headers:{"Content-Type":"application/zip","Cache-Control":"private, no-store","Content-Disposition":`attachment; filename="${name}.zip"`}});
}catch(e){return fail(e);}}
