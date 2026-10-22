import { neon } from "@neondatabase/serverless";
import { put, get, del } from "@vercel/blob";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import path from "node:path";

const localRoot=path.join(process.cwd(),".accord-data");
const conflict="CONFLICT: This workspace changed in another tab. Refresh and try again.";
function local(){return !process.env.DATABASE_URL&&!process.env.VERCEL;}
function database(){
  if(!process.env.DATABASE_URL)throw new Error("SETUP: Connect a Neon database in Vercel Storage to configure DATABASE_URL.");
  return neon(process.env.DATABASE_URL);
}
let schema:Promise<unknown>|undefined;
async function ready(){
  if(!schema)schema=database()`CREATE TABLE IF NOT EXISTS accord_workspaces (session_hash TEXT PRIMARY KEY, snapshot TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`.catch(error=>{schema=undefined;throw error;});
  await schema;
}
type Stored={snapshot:string;version:number};
function safeKey(key:string){if(!/^[a-f0-9]{64}$/.test(key))throw new Error("Invalid workspace key");return key;}
function workspacePath(key:string){return path.join(localRoot,"workspaces",safeKey(key)+".json");}
async function locked<T>(key:string,action:()=>Promise<T>):Promise<T>{
  await mkdir(path.join(localRoot,"workspaces"),{recursive:true});
  const lock=workspacePath(key)+".lock";
  let handle;
  for(let i=0;i<100;i++){
    try{handle=await open(lock,"wx");break;}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;await new Promise(resolve=>setTimeout(resolve,10));}
  }
  if(!handle)throw new Error(conflict);
  try{return await action();}finally{await handle.close();await unlink(lock);}
}
export async function loadWorkspace(key:string):Promise<Stored|null>{
  if(local()){
    try{return JSON.parse(await readFile(workspacePath(key),"utf8")) as Stored;}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
  }
  await ready();
  const rows=await database()`SELECT snapshot,version FROM accord_workspaces WHERE session_hash=${safeKey(key)}`;
  return rows[0] as Stored??null;
}
export async function createWorkspace(key:string,snapshot:string){
  if(local()){await mkdir(path.dirname(workspacePath(key)),{recursive:true});await writeFile(workspacePath(key),JSON.stringify({snapshot,version:1}),{flag:"wx"});return;}
  await ready();await database()`INSERT INTO accord_workspaces (session_hash,snapshot,version) VALUES (${safeKey(key)},${snapshot},1)`;
}
export async function updateWorkspace(key:string,snapshot:string,version:number){
  if(local())return locked(key,async()=>{
    const existing=await loadWorkspace(key);if(existing?.version!==version)throw new Error(conflict);
    const target=workspacePath(key);const temporary=target+"."+crypto.randomUUID()+".tmp";
    await writeFile(temporary,JSON.stringify({snapshot,version:version+1}));await rename(temporary,target);
  });
  await ready();const rows=await database()`UPDATE accord_workspaces SET snapshot=${snapshot},version=version+1,updated_at=NOW() WHERE session_hash=${safeKey(key)} AND version=${version} RETURNING version`;
  if(rows.length!==1)throw new Error(conflict);
}
function filePath(key:string,id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("Invalid asset ID");return `accord/${safeKey(key)}/${id}`;}
function localFiles(){return !process.env.VERCEL&&!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID;}
function requireBlob(){if(!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID)throw new Error("SETUP: Connect a private Vercel Blob store before uploading files.");}
export async function putOriginal(key:string,id:string,bytes:Uint8Array,type:string){
  const pathname=filePath(key,id);
  if(localFiles()){const target=path.join(localRoot,pathname);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:"wx"});return;}
  requireBlob();await put(pathname,Buffer.from(bytes),{access:"private",contentType:type,addRandomSuffix:false});
}
export async function getOriginal(key:string,id:string):Promise<Uint8Array|null>{
  const pathname=filePath(key,id);
  if(localFiles()){try{return await readFile(path.join(localRoot,pathname));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}}
  requireBlob();const result=await get(pathname,{access:"private",useCache:false});
  if(!result||result.statusCode!==200||!result.stream)return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
export async function deleteOriginal(key:string,id:string){
  const pathname=filePath(key,id);
  if(localFiles()){await unlink(path.join(localRoot,pathname)).catch(error=>{if(error.code!=="ENOENT")throw error;});return;}
  requireBlob();await del(pathname);
}
