export type Category = "Claims" | "Terminology" | "Tone" | "Messaging" | "Visual" | "Accessibility";
export type Actor = "creator" | "reviewer";
export type Status = "Draft" | "Needs changes" | "In review" | "Approved" | "Released";
export type Rule = { id: string; title: string; category: Category; instruction: string; source: string; version: number; active: boolean; expires?: string; type: "offer" | "term" | "tone" | "message" | "claim" | "visual" | "accessibility"; match?: string; replacement?: string; value?: number; color?: string };
export type Asset = { id: string; name: string; type: string; url: string; text: string; alt: string; palette: string[]; width: number; height: number; logoVersion: string; textColor: string; backgroundColor: string };
export type Finding = { id: string; category: Category; severity: "High" | "Medium" | "Low"; title: string; explanation: string; excerpt: string; suggestion: string; sourceIds: string[]; evidence: { id: string; title: string; instruction: string; version: number; source: string }[]; method: "Rule" | "AI" | "Human review"; state: "Open" | "Dismissed"; reason?: string; location: string; blocking: boolean };
export type Review = { id: string; revision: number; packVersion: number; hash: string; completedAt: string; findings: Finding[]; engine: string; coverage: { name: string; status: "Checked" | "Needs human review"; detail: string }[]; modelError?: string };
export type Comment = { id: string; actor: Actor; text: string; at: string; revision: number };
export type Revision = { number: number; text: string; at: string; title: string; assets: Asset[] };
export type Campaign = { id: string; title: string; channel: string; audience: string; purpose: string; text: string; assets: Asset[]; revision: number; status: Status; createdAt: string; updatedAt: string; review?: Review; history: Revision[]; comments: Comment[]; approval?: { at: string; hash: string; revision: number; packVersion: number; actor: string; note: string }; releasedAt?: string };
export type Event = { id: string; at: string; action: string; actor: Actor | "system"; campaignId?: string; detail: string };
export type Workspace = { id: string; version: number; brand: string; packVersion: number; rules: Rule[]; campaigns: Campaign[]; events: Event[]; actor: Actor; createdAt: string };

export const categories: Category[] = ["Claims", "Terminology", "Tone", "Messaging", "Visual", "Accessibility"];
export const demoText = "Hurry! Get 50% off every plan with lumen pro. Guaranteed to double your results. The best plan for everyone. Start today.";
export const correctedText = "Meet Lumen Pro. New customers can save 20% on annual plans until 30 November 2026. Explore the plan that suits you.";

export function makeWorkspace(): Workspace {
  const at = new Date().toISOString();
  const rules: Rule[] = [
    { id: "FACT-01", title: "Autumn offer", category: "Claims", type: "offer", instruction: "New customers receive 20% off annual plans until 30 November 2026. No other plans are included.", source: "Campaign brief / Offer terms", version: 1, active: true, value: 20, expires: "2026-11-30" },
    { id: "FACT-02", title: "Performance promises", category: "Claims", type: "claim", instruction: "No approved evidence supports guarantees, doubled results or fastest/best-in-market claims. Such claims require an authorised reviewer and approved substantiation.", source: "Approved facts / Claims register", version: 1, active: true },
    { id: "TERM-01", title: "Product name", category: "Terminology", type: "term", instruction: "Use the exact product name Lumen Pro, with both words capitalised.", source: "Brand guide / Naming", version: 1, active: true, match: "lumen pro", replacement: "Lumen Pro" },
    { id: "TONE-01", title: "Helpful, never pressuring", category: "Tone", type: "tone", instruction: "Use clear, helpful language. Avoid pressure phrases such as Hurry!, Act now! and Don't miss out. Preserve the offer and invitation to explore.", source: "Brand guide / Voice and tone", version: 1, active: true },
    { id: "MSG-01", title: "Offer qualifications", category: "Messaging", type: "message", instruction: "When a discount is mentioned, include new-customer eligibility, annual-plan scope and the offer end date in each relevant campaign item.", source: "Campaign brief / Required messaging", version: 1, active: true },
    { id: "VIS-01", title: "Current identity", category: "Visual", type: "visual", instruction: "Use logo version 2026.1. Approved graphic colours are #254C42, #F4F3EC and #D4E6CF. Photography is exempt from palette matching; logo placement and proportion require human inspection.", source: "Asset library / Identity 2026.1", version: 1, active: true, color: "#254C42", replacement: "2026.1" },
    { id: "A11Y-01", title: "Readable and described", category: "Accessibility", type: "accessibility", instruction: "Supply meaningful alternative text for images. Normal text should meet a 4.5:1 contrast ratio. Human review must check context, reading order and the final publishing environment.", source: "Accessibility checklist / WCAG 2.2 AA", version: 1, active: true },
  ];
  return { id: crypto.randomUUID(), version: 1, brand: "Lumen", packVersion: 1, rules, actor: "creator", campaigns: [{ id: crypto.randomUUID(), title: "Autumn launch", channel: "Social campaign", audience: "New customers", purpose: "Introduce Lumen Pro and invite new customers to explore the annual subscription offer.", text: demoText, assets: [], revision: 1, status: "Draft", createdAt: at, updatedAt: at, history: [], comments: [] }], events: [{ id: crypto.randomUUID(), at, action: "Workspace created", actor: "system", detail: "A private judge sandbox with fictional Lumen brand references." }], createdAt: at };
}
export function logEvent(w: Workspace, action: string, detail: string, campaignId?: string) {
  w.events.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: w.actor, action, detail, campaignId });
  w.events = w.events.slice(0, 150);
}
export function openBlockers(c: Campaign) { return c.review?.findings.filter(f => f.blocking && f.state === "Open") ?? []; }
export async function contentHash(c: Pick<Campaign, "title" | "channel" | "audience" | "purpose" | "text" | "assets">) {
  const bytes = new TextEncoder().encode(JSON.stringify([c.title,c.channel,c.audience,c.purpose,c.text,c.assets]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
}
export function ratio(fg: string, bg: string) {
  const lum = (hex: string) => { const c = hex.replace("#", ""); const rgb = [0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; };
  const a=lum(fg),b=lum(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
