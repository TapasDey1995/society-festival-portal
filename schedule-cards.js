import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const COMMITTEE_EMAIL='committee@meenaorchid.local';
const TAPAS_EMAIL='tapas@meenaorchid.local';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);

function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));}
function isStaff(p){return ['admin','treasurer','committee'].includes(p?.role);}
function msg(t,bad=false){const e=$('scheduleCardMessage');if(e){e.textContent=t;e.classList.toggle('negative',bad);}}

// Use event delegation on document. This keeps working even if another script
// replaces/recreates the schedule button after this module loads.
document.addEventListener('click',e=>{
  const b=e.target.closest?.('#showScheduleForm');
  if(!b)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const p=$('quickSchedulePanel');
  if(p)p.classList.toggle('hidden');
  msg('');
},true);

async function profile(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return null;
  const {data}=await supabase.from('user_profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(data)return data;
  if(session.user.email===COMMITTEE_EMAIL)return {role:'committee',society_id:SOCIETY_ID};
  if(session.user.email===TAPAS_EMAIL)return {role:'admin',society_id:SOCIETY_ID};
  return null;
}

async function load(){
  const target=$('scheduleCards');
  if(!target)return;
  const {data,error}=await supabase.from('puja_schedule_cards').select('*').eq('society_id',SOCIETY_ID).order('sort_order').order('created_at');
  if(error){console.error(error);target.innerHTML='<p class="muted">Unable to load puja schedule.</p>';return;}
  target.innerHTML=(data||[]).map(x=>`<article class="schedule-card-item"><h3>${esc(x.header)}</h3><div class="schedule-card-content">${esc(x.content).replace(/\n/g,'<br>')}</div></article>`).join('')||'<div class="schedule-empty muted">No puja schedule has been added yet.</div>';
}

async function staffUi(){
  const p=await profile();
  const b=$('showScheduleForm');
  if(b)b.classList.toggle('hidden',!isStaff(p));
  if(!isStaff(p))$('quickSchedulePanel')?.classList.add('hidden');
}

async function save(e){
  e.preventDefault();
  const p=await profile();
  if(!isStaff(p)){msg('Committee login required.',true);return;}
  const header=$('quickScheduleHeader')?.value.trim();
  const content=$('quickScheduleContent')?.value.trim();
  if(!header||!content){msg('Please enter both header and content.',true);return;}
  const {data:last,error:lastError}=await supabase.from('puja_schedule_cards').select('sort_order').eq('society_id',SOCIETY_ID).order('sort_order',{ascending:false}).limit(1).maybeSingle();
  if(lastError){msg(lastError.message,true);return;}
  const {error}=await supabase.from('puja_schedule_cards').insert({society_id:SOCIETY_ID,header,content,sort_order:Number(last?.sort_order||0)+1,updated_at:new Date().toISOString()});
  if(error){console.error(error);msg(error.message,true);return;}
  e.target.reset();
  $('quickSchedulePanel')?.classList.add('hidden');
  msg('Schedule added successfully.');
  await load();
}

document.addEventListener('submit',e=>{if(e.target?.id==='quickScheduleForm'){e.stopImmediatePropagation();save(e);}},true);

async function init(){
  await staffUi();
  await load();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
supabase.auth.onAuthStateChange(()=>setTimeout(staffUi,150));
