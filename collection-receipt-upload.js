import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const DOCUMENT_BUCKET='festival-documents';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

function slugFileName(name){
  return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,120);
}

function isStaff(){
  const role=(document.getElementById('roleBadge')?.textContent||'').trim().toLowerCase();
  return ['admin','treasurer','committee'].includes(role);
}

function esc(v){
  return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
}

async function uploadReceipt(file){
  if(!file)return null;
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))throw new Error('Only PDF, JPG, PNG or WEBP files are allowed.');
  if(file.size>10*1024*1024)throw new Error('File must be 10 MB or smaller.');
  const path=`receipts/${Date.now()}-${crypto.randomUUID()}-${slugFileName(file.name)}`;
  const {error}=await supabase.storage.from(DOCUMENT_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error)throw error;
  return supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path).data.publicUrl;
}

function decorateReceiptCells(){
  if(!isStaff())return;
  const body=document.getElementById('collectionBody');
  if(!body)return;
  body.querySelectorAll('tr').forEach(row=>{
    const cells=row.querySelectorAll('td');
    if(cells.length<13 || cells[10].querySelector('.receipt-upload-wrap'))return;
    const receiptLink=cells[10].querySelector('a');
    const existingUrl=receiptLink?.getAttribute('href')||'';
    const id=row.querySelector('.edit-collection')?.dataset.id;
    if(!id)return;
    cells[10].innerHTML=`${existingUrl?`<a href="${esc(existingUrl)}" target="_blank" rel="noopener">View receipt</a><br/>`:'<span class="muted">No receipt uploaded</span><br/>'}<span class="receipt-upload-wrap"><label style="display:inline-block;cursor:pointer;margin-top:6px;padding:7px 10px;border:1px solid #ccc;border-radius:6px;background:#fff;font-size:13px;font-weight:600;">${existingUrl?'Replace receipt':'Upload receipt'}<input class="collection-receipt-upload" data-id="${esc(id)}" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" style="display:none"/></label><span class="receipt-upload-status muted" style="display:block;font-size:12px;margin-top:4px;"></span></span>`;
  });
  body.querySelectorAll('.collection-receipt-upload').forEach(input=>{
    input.onchange=async()=>{
      const file=input.files?.[0];
      if(!file)return;
      const status=input.parentElement?.parentElement?.querySelector('.receipt-upload-status');
      try{
        input.disabled=true;
        if(status)status.textContent='Uploading...';
        const url=await uploadReceipt(file);
        const {error}=await supabase.from('collections').update({file_upload_url:url,receipt_url:url,receipt_download_url:url,updated_at:new Date().toISOString()}).eq('id',input.dataset.id);
        if(error)throw error;
        if(status)status.textContent='Saved. Refreshing...';
        window.location.reload();
      }catch(error){
        if(status)status.textContent=error?.message||'Upload failed.';
        input.disabled=false;
      }
    };
  });
}

function watchReceiptTable(){
  const body=document.getElementById('collectionBody');
  if(body)new MutationObserver(decorateReceiptCells).observe(body,{childList:true,subtree:true});
  const roleBadge=document.getElementById('roleBadge');
  if(roleBadge)new MutationObserver(decorateReceiptCells).observe(roleBadge,{childList:true,subtree:true,characterData:true});
  decorateReceiptCells();
  setTimeout(decorateReceiptCells,300);
  setTimeout(decorateReceiptCells,1000);
  setTimeout(decorateReceiptCells,2000);
}

document.addEventListener('DOMContentLoaded',watchReceiptTable);
if(document.readyState!=='loading')watchReceiptTable();
