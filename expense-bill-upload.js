import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const DOCUMENT_BUCKET='festival-documents';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const safeUrl=v=>esc(String(v||'').trim());
const slugFileName=name=>String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,120);

function isStaff(){
  const role=(document.getElementById('roleBadge')?.textContent||'').trim().toLowerCase();
  return ['admin','treasurer','committee'].includes(role);
}

async function uploadBill(input){
  const file=input.files?.[0];
  if(!file)return;
  if(!allowed.includes(file.type)){alert('Only PDF, JPG, PNG or WEBP files are allowed.');input.value='';return;}
  if(file.size>10*1024*1024){alert('File must be 10 MB or smaller.');input.value='';return;}
  const id=input.dataset.id;
  if(!id)return;
  input.disabled=true;
  const label=input.closest('label');
  const original=label?.querySelector('.expense-upload-text')?.textContent||'Upload bill';
  if(label?.querySelector('.expense-upload-text'))label.querySelector('.expense-upload-text').textContent='Uploading...';
  try{
    const path=`bills/${Date.now()}-${crypto.randomUUID()}-${slugFileName(file.name)}`;
    const {error:uploadError}=await supabase.storage.from(DOCUMENT_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(uploadError)throw uploadError;
    const {data}=supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path);
    const url=data.publicUrl;
    const {error:updateError}=await supabase.from('expenses').update({bill_url:url,updated_at:new Date().toISOString()}).eq('id',id);
    if(updateError)throw updateError;
    if(window.refreshAuth)await window.refreshAuth();
    if(window.location)window.location.reload();
  }catch(error){
    console.error('Expense bill upload failed:',error);
    alert('Bill upload failed: '+(error?.message||String(error)));
    input.value='';
    input.disabled=false;
    if(label?.querySelector('.expense-upload-text'))label.querySelector('.expense-upload-text').textContent=original;
  }
}

function decorateExpenseRows(){
  if(!isStaff())return;
  const container=document.getElementById('expenseGroups');
  if(!container)return;
  container.querySelectorAll('tbody tr').forEach(row=>{
    const status=row.querySelector('.expense-status');
    if(!status)return;
    const id=status.dataset.id;
    const cells=row.children;
    if(cells.length<9)return;
    const billCell=cells[8];
    if(billCell.dataset.uploadReady==='1')return;
    billCell.dataset.uploadReady='1';
    const existingLink=billCell.querySelector('a');
    const existing=existingLink?.href||'';
    billCell.innerHTML=`${existing?`<a href="${safeUrl(existing)}" target="_blank" rel="noopener">View file</a>`:'<span class="muted">No bill uploaded</span>'}<br/><label class="secondary expense-upload-label"><span class="expense-upload-text">${existing?'Replace bill':'Upload bill'}</span><input type="file" data-id="${esc(id)}" accept="application/pdf,image/jpeg,image/png,image/webp" hidden/></label>`;
    const input=billCell.querySelector('input[type=file]');
    input.addEventListener('change',()=>uploadBill(input));
  });
}

const observer=new MutationObserver(()=>decorateExpenseRows());
function init(){
  const container=document.getElementById('expenseGroups');
  if(container)observer.observe(container,{childList:true,subtree:true});
  decorateExpenseRows();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
