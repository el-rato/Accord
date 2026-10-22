import { z } from "zod";
import { bootstrap, checkOrigin, fail, json, persist, readWorkspace, SESSION_COOKIE } from "@/lib/store";
import { type Campaign, type Rule, type Workspace, contentHash, logEvent, makeWorkspace, openBlockers } from "@/lib/model";
import { runReview, DEFAULT_GEMINI_MODEL } from "@/lib/review";

export const dynamic="force-dynamic";
export const maxDuration=60;
const bodySchema=z.object({ action:z.enum(["role","create","save","review","submit","approve","request_changes","dismiss","comment","rule","release","reset","delete_asset"]),version:z.number().int().positive(),campaignId:z.string().max(80).optional(),role:z.enum(["creator","reviewer"]).optional(),title:z.string().max(100).optional(),text:z.string().max(14000).optional(),purpose:z.string().max(1000).optional(),audience:z.string().max(100).optional(),channel:z.string().max(100).optional(),note:z.string().max(2000).optional(),findingId:z.string().max(80).optional(),assetId:z.string().max(80).optional(),confirmCoverage:z.boolean().optional(),rule:z.object({id:z.string().max(80),title:z.string().min(1).max(120),instruction:z.string().min(5).max(2000),active:z.boolean(),value:z.number().min(0).max(100).optional(),expires:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),replacement:z.string().max(120).optional()}).optional()});
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
function reviewer(w:Workspace){assert(w.actor==="reviewer","FORBIDDEN: Switch to the reviewer persona to perform this action");}
async function current(w:Workspace,c:Campaign){assert(c.review,"Run a review before continuing");assert(c.review.revision===c.revision&&c.review.packVersion===w.packVersion&&c.review.hash===await contentHash(c),"This review is out of date. Run the checks again.");}

export async function GET(request:Request){try{const {w,token}=await bootstrap(request);const e=process.env;return json({workspace:w,aiConfigured:!!e.GEMINI_API_KEY,model:e.GEMINI_MODEL??DEFAULT_GEMINI_MODEL,sandbox:true},200,token?{"Set-Cookie":`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(request.url).protocol==="https:"?"; Secure":""}`}:{})}catch(e){return fail(e);}}

export async function POST(request:Request){try{
  checkOrigin(request);
  assert(Number(request.headers.get("content-length")??0)<70000,"Request is too large");
  const raw=await request.text();assert(raw.length<70000,"Request is too large");
  const b=bodySchema.parse(JSON.parse(raw));const {key,w}=await readWorkspace(request);
  assert(b.version===w.version,"CONFLICT: This workspace changed. Refresh before continuing.");
  const c=b.campaignId?w.campaigns.find(c=>c.id===b.campaignId):undefined;
  if(!["role","create","reset","rule"].includes(b.action))assert(c,"NOT_FOUND: Campaign not found");
  const now=new Date().toISOString();
  switch(b.action){
    case "role":assert(b.role,"Choose a persona");w.actor=b.role;logEvent(w,"Demo persona changed",`Acting as ${b.role}. Persona switching is a sandbox feature, not production role authentication.`);break;
    case "create":{
      assert(w.campaigns.length<25,"This sandbox supports up to 25 campaigns");
      const campaign:Campaign={id:crypto.randomUUID(),title:b.title?.trim()||"Untitled campaign",channel:b.channel||"Social campaign",audience:b.audience||"New customers",purpose:b.purpose||"",text:b.text||"",assets:[],revision:1,status:"Draft",createdAt:now,updatedAt:now,history:[],comments:[]};
      w.campaigns.unshift(campaign);logEvent(w,"Campaign created",campaign.title,campaign.id);break;
    }
    case "save":{
      assert(b.text!==undefined,"Draft text is required");
      c!.history.unshift({number:c!.revision,text:c!.text,at:c!.updatedAt,title:c!.title,assets:structuredClone(c!.assets)});c!.history=c!.history.slice(0,15);
      c!.text=b.text;c!.title=b.title?.trim()||c!.title;c!.purpose=b.purpose??c!.purpose;c!.audience=b.audience??c!.audience;c!.channel=b.channel??c!.channel;c!.revision++;c!.status="Draft";c!.updatedAt=now;delete c!.approval;delete c!.releasedAt;
      logEvent(w,"Revision saved",`Revision ${c!.revision}; any previous approval is invalidated.`,c!.id);break;
    }
    case "review":{
      assert(c!.text.trim()||c!.assets.length,"Add content before running a review");const e=process.env;
      c!.review=await runReview(w,c!,e.GEMINI_API_KEY,e.GEMINI_MODEL??DEFAULT_GEMINI_MODEL);c!.status=openBlockers(c!).length?"Needs changes":"Draft";delete c!.approval;delete c!.releasedAt;
      logEvent(w,"Review completed",`${c!.review.findings.length} findings; ${openBlockers(c!).length} blocking. ${c!.review.engine}.`,c!.id);break;
    }
    case "submit":await current(w,c!);assert(!openBlockers(c!).length,"Resolve blocking findings before submitting");assert(c!.purpose.trim(),"Add the intended purpose before submitting");c!.status="In review";logEvent(w,"Submitted for approval",`Revision ${c!.revision}, brand pack v${w.packVersion}.`,c!.id);break;
    case "approve":reviewer(w);assert(c!.status==="In review","Submit this campaign for review first");await current(w,c!);assert(!openBlockers(c!).length,"Blocking findings remain unresolved");assert(b.confirmCoverage,"Confirm that you inspected the content, evidence and coverage gaps");assert(b.note?.trim(),"Add a reviewer decision note");c!.approval={at:now,hash:await contentHash(c!),revision:c!.revision,packVersion:w.packVersion,actor:"Reviewer persona (sandbox)",note:b.note!.trim()};c!.status="Approved";logEvent(w,"Revision approved",b.note!.trim(),c!.id);break;
    case "request_changes":reviewer(w);assert(b.note?.trim(),"Explain the changes needed");c!.status="Needs changes";delete c!.approval;logEvent(w,"Changes requested",b.note!.trim(),c!.id);c!.comments.push({id:crypto.randomUUID(),actor:w.actor,text:b.note!.trim(),at:now,revision:c!.revision});break;
    case "dismiss":reviewer(w);await current(w,c!);assert(b.note?.trim()&&b.note.trim().length>=10,"Record a reason of at least 10 characters");const f=c!.review!.findings.find(f=>f.id===b.findingId);assert(f,"Finding not found");assert(f.state==="Open","This finding has already been resolved");f.state="Dismissed";f.reason=b.note!.trim();logEvent(w,"Finding dismissed",`${f.title}: ${f.reason}`,c!.id);break;
    case "comment":assert(b.note?.trim(),"Write a comment first");assert(c!.comments.length<100,"Comment limit reached for this campaign");c!.comments.push({id:crypto.randomUUID(),actor:w.actor,text:b.note!.trim(),at:now,revision:c!.revision});logEvent(w,"Comment added",b.note!.trim().slice(0,200),c!.id);break;
    case "rule":{
      reviewer(w);assert(b.rule,"Rule data is required");const r=w.rules.find(r=>r.id===b.rule!.id);assert(r,"Reference not found");
      if(r.type==="offer"){
        assert(b.rule.value!==undefined&&b.rule.expires,"Offer amount and expiry are required");
        const date=new Date(`${b.rule.expires}T00:00:00Z`);assert(Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===b.rule.expires,"Choose a valid expiry date");
        const label=date.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
        b.rule.instruction=`New customers receive ${b.rule.value}% off annual plans until ${label}. No other plans are included.`;
      }
      if(r.type==="term"){const spelling=b.rule.replacement?.trim();assert(spelling,"A preferred spelling is required");b.rule.instruction=`Use the exact product name ${spelling}.`;}
      Object.assign(r,b.rule,{version:r.version+1});w.packVersion++;
      for(const draft of w.campaigns){if(draft.review){draft.status="Needs changes";delete draft.approval;delete draft.releasedAt;}}
      logEvent(w,"Brand reference updated",`${r.id} is now v${r.version}. Brand pack v${w.packVersion}; previous reviews require a fresh check.`);break;
    }
    case "release":await current(w,c!);assert(c!.approval&&["Approved","Released"].includes(c!.status),"A reviewer must approve this revision before release");assert(c!.approval.hash===await contentHash(c!)&&c!.approval.packVersion===w.packVersion,"Approval is stale");assert(!openBlockers(c!).length,"Blocking findings remain");const offer=w.rules.find(r=>r.type==="offer"&&r.active);if(offer?.expires&&offer.expires<now.slice(0,10)&&/\d+\s*%/.test(c!.text))throw new Error("The offer expired after review. Update the evidence and run a fresh review.");c!.status="Released";c!.releasedAt=now;logEvent(w,"Approved package released",`Exact revision ${c!.revision}. SHA-256 ${c!.approval.hash.slice(0,12)}…`,c!.id);break;
    case "delete_asset":const asset=c!.assets.find(a=>a.id===b.assetId);assert(asset,"Asset not found");c!.assets=c!.assets.filter(a=>a.id!==b.assetId);c!.revision++;c!.status="Draft";delete c!.approval;delete c!.releasedAt;logEvent(w,"Creative removed",`${asset.name}; review and approval invalidated.`,c!.id);break;
    case "reset":{const fresh=makeWorkspace();fresh.version=w.version;Object.assign(w,fresh);logEvent(w,"Sandbox reset","Fictional references and the sample campaign were restored.");break;}
  }
  await persist(key,w,b.version);return json({workspace:w});
}catch(e){return fail(e);}}
