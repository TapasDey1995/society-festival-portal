import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const COMMITTEE_EMAIL='committee@meenaorchid.local';
const TAPAS_EMAIL='tapas@meenaorchid.local';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function isStaff(profile){return ['admin','treasurer','committee'].includes(profile?.role);}

async function getProfile(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return null;
  const {data}=await supabase.from('user_profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(data)return data;
  if(session.user.email===COMMITTEE_EMAIL)return {role:'committee',society_id:SOCIETY_ID};
  if(session.user.email===TAPAS_EMAIL)return {role:'admin',society_id:SOCIETY_ID};
  return null;
}

async function loadScheduleCards(){
  const {data,error}=await supabase.from('puja_schedule_cards').select('*').eq('society_id',SOCIETY_ID).order('sort_order').order('created_at');
  if(error){
    console.error('Schedule cards load error:',error);
    if($('scheduleCards'))$('scheduleCards').innerHTML='<p class="muted">Unable to load puja schedule.</p>';
    return;
  }
  const rows=data||[];
  $('scheduleCards').innerHTML=rows.map(x=>`<article class="schedule-card-item"><h3>${esc(x.header)}</h3><div class="schedule-card-content">${esc(x.content).replace(/\n/g,'<br>')}</div></article>`).join('')||'<div class="schedule-empty muted">No puja schedule has been added yet.</div>';
}

async function syncStaffUi(){
  const profile=await getProfile();
  const staff=isStaff(profile);
  $('showScheduleForm')?.classList.toggle('hidden',!staff);
  if(!staff)$('quickSchedulePanel')?.classList.add('hidden');
}

async function addScheduleCard(ev){
  ev.preventDefault();
  const profile=await getProfile();
  if(!isStaff(profile)){setMessage('Only committee members can add schedules.',true);return;}
  const header=$('quickScheduleHeader').value.trim();
  const content=$('quickScheduleContent').value.trim();
  if(!header||!content){setMessage('Please enter both header and content.',true);return;}
  const {data:last}=await supabase.from('puja_schedule_cards').select('sort_order').eq('society_id',SOCIETY_ID).order('sort_order',{ascending:false}).limit(1).maybeSingle();
  const nextOrder=Number(last?.sort_order||0)+1;
  const {error}=await supabase.from('puja_schedule_cards').insert({society_id:SOCIETY_ID,header,content,sort_order:nextOrder,updated_at:new Date().toISOString()});
  if(error){setMessage(error.message,true);return;}
  ev.target.reset();
  setMessage('Schedule added successfully.');
  $('quickSchedulePanel').classList.add('hidden');
  await loadScheduleCards();
}

function setMessage(text,error=false){
  const el=$('scheduleCardMessage');
  if(el){el.textContent=text;el.classList.toggle('negative',error);}
}

function init(){
  $('showScheduleForm')?.addEventListener('click',()=>{
    $('quickSchedulePanel').classList.toggle('hidden');
    setMessage('');
  });
  $('quickScheduleForm')?.addEventListener('submit',addScheduleCard);
  loadScheduleCards();
  syncStaffUi();
  supabase.auth.onAuthStateChange(()=>setTimeout(syncStaffUi,100));
}

document.addEventListener('DOMContentLoaded',init);
