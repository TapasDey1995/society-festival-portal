import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const BUCKET='festival-documents';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const alertError=msg=>{alert(msg);console.error('[Collection]',msg);};
function staff(role){return ['admin','treasurer','committee'].includes(String(role||'').toLowerCase());}
function slug(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,120);}

async function getStaffProfile(){
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError) throw sessionError;
  if(!session) throw new Error('Please login as committee/admin before adding a collection.');
  const {data,error}=await supabase.from('user_profiles').select('id,society_id,role').eq('id',session.user.id).maybeSingle();
  if(error) throw error;
  const profile=data || (session.user.email==='committee@meenaorchid.local'?{society_id:SOCIETY_ID,role:'committee'}:session.user.email==='tapas@meenaorchid.local'?{society_id:SOCIETY_ID,role:'admin'}:null);
  if(!profile || profile.society_id!==SOCIETY_ID || !staff(profile.role)) throw new Error('Committee/admin login is required to add a collection.');
  return profile;
}

async function uploadReceipt(file){
  if(!file) return null;
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type)) throw new Error('Receipt must be PDF, JPG, PNG or WEBP.');
  if(file.size>10*1024*1024) throw new Error('Receipt file must be 10 MB or smaller.');
  const path=`receipts/${Date.now()}-${crypto.randomUUID()}-${slug(file.name)}`;
  const {error}=await supabase.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function saveCollection(form){
  const v=id=>($(id)?.value||'').trim();
  const festivalId=v('quickCollectionFestival');
  const block=v('quickCollectionBlock');
  const flat=v('quickCollectionFlat');
  const name=v('quickCollectionName');
  const amount=Number(v('quickCollectionAmount'));
  const date=v('quickCollectionDate');
  const mode=v('quickCollectionMode')||'UPI';
  const status=v('quickCollectionStatus')||'Paid';
  const receiptNo=v('quickCollectionReceiptNo');
  const transactionId=v('quickCollectionTransactionId');
  const collectionType=v('quickCollectionType')||'Flat wise 2026 collection';
  const file=$('quickCollectionReceiptFile')?.files?.[0]||null;

  if(!festivalId) return alertError('Please select a festival/category.');
  if(!block || !flat) return alertError('Please enter Block No and Flat No.');
  if(!Number.isFinite(amount) || amount<=0) return alertError('Please enter a valid collection amount greater than 0.');
  if(!date) return alertError('Please select the collection date.');

  await getStaffProfile();
  const receiptUrl=await uploadReceipt(file);
  const payload={
    festival_id:festivalId,
    member_id:null,
    collection_type:collectionType,
    collection_date:date,
    amount,
    status,
    receipt_url:receiptUrl,
    notes:[name,`Block ${block}`,`Flat ${flat}`].filter(Boolean).join(' | '),
    payment_mode:mode,
    receipt_no:receiptNo||null,
    transaction_id:transactionId||null,
    file_upload_url:receiptUrl,
    receipt_download_url:receiptUrl,
    updated_at:new Date().toISOString()
  };

  const {error}=await supabase.from('collections').insert(payload);
  if(error) throw error;

  form.reset();
  const dateEl=$('quickCollectionDate');
  if(dateEl) dateEl.value=new Date().toISOString().slice(0,10);
  alert('Collection saved successfully.');
  window.dispatchEvent(new CustomEvent('collection-saved'));
  if(typeof window.refreshCollectionData==='function') await window.refreshCollectionData();
  else location.reload();
}

function setup(){
  const original=$('quickCollectionForm');
  if(!original) return;
  const form=original.cloneNode(true);
  original.replaceWith(form);
  const date=$('quickCollectionDate');
  if(date && !date.value) date.value=new Date().toISOString().slice(0,10);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const button=form.querySelector('button[type="submit"]');
    if(button){button.disabled=true;button.textContent='Saving...';}
    try{await saveCollection(form);}
    catch(error){alertError(error?.message||String(error));}
    finally{if(button){button.disabled=false;button.textContent='Save Collection';}}
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true}); else setup();