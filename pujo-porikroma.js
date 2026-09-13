import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const BUCKET='festival-documents';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function isStaff(profile){return !!profile&&['admin','treasurer','committee'].includes(profile.role);}

async function loadGallery(){
  const {data,error}=await supabase.from('pujo_porikroma').select('*').eq('society_id',SOCIETY_ID).order('created_at',{ascending:false});
  const root=$('porikromaGallery');
  if(!root)return;
  if(error){root.innerHTML='<p class="muted">Unable to load gallery.</p>';console.error(error);return;}
  const groups=[];
  const map=new Map();
  (data||[]).forEach(item=>{
    if(!map.has(item.header)){const group={header:item.header,images:[]};map.set(item.header,group);groups.push(group);}
    map.get(item.header).images.push(item);
  });
  if(!groups.length){root.innerHTML='<div class="porikroma-empty">No gallery images added yet.</div>';return;}
  root.innerHTML=groups.map(group=>`<section class="porikroma-frame"><h3>${esc(group.header)}</h3><div class="porikroma-grid">${group.images.map(item=>`<a class="porikroma-photo" href="${esc(item.image_url)}" target="_blank" rel="noopener"><img src="${esc(item.image_url)}" alt="${esc(group.header)}" loading="lazy"/></a>`).join('')}</div></section>`).join('');
}

async function init(){
  const form=$('porikromaAdminForm');
  const panel=$('porikromaAdminPanel');
  const message=$('porikromaMessage');
  const {data:{session}}=await supabase.auth.getSession();
  let profile=null;
  if(session){
    const {data}=await supabase.from('user_profiles').select('role,society_id').eq('id',session.user.id).maybeSingle();
    profile=data;
  }
  if(panel)panel.classList.toggle('hidden',!isStaff(profile));
  if(form){
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();
      if(!isStaff(profile)){if(message)message.textContent='Committee login required.';return;}
      const header=$('porikromaHeader').value.trim();
      const file=$('porikromaImage').files?.[0];
      if(!header||!file){if(message)message.textContent='Please enter a header and choose an image.';return;}
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)){if(message)message.textContent='Please upload JPG, PNG or WEBP image.';return;}
      if(file.size>10*1024*1024){if(message)message.textContent='Image must be 10 MB or smaller.';return;}
      const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(0,120);
      if(message)message.textContent='Uploading image...';
      const path=`porikroma/${Date.now()}-${crypto.randomUUID()}-${safe}`;
      const upload=await supabase.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(upload.error){if(message)message.textContent='Upload failed: '+upload.error.message;return;}
      const imageUrl=supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const {error}=await supabase.from('pujo_porikroma').insert({society_id:SOCIETY_ID,header,image_url:imageUrl});
      if(error){if(message)message.textContent='Could not save gallery image: '+error.message;return;}
      form.reset();
      if(message)message.textContent='Image added to Pujo Porikroma.';
      await loadGallery();
    });
  }
  await loadGallery();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
