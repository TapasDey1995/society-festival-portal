import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const BUCKET='festival-documents';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(v||0));
const isAllowedFile=(f,types)=>!!f&&types.includes(f.type)&&f.size<=10*1024*1024;
let staff=false;
let currentSettings=null;

async function getStaffStatus(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return false;
  const {data,error}=await supabase.from('user_profiles').select('role,society_id').eq('id',session.user.id).maybeSingle();
  if(!error&&data)return data.society_id===SOCIETY_ID&&['admin','treasurer','committee'].includes(String(data.role||'').toLowerCase());
  // Keep compatibility with the portal's existing local committee accounts.
  return ['tapas@meenaorchid.local','committee@meenaorchid.local'].includes(String(session.user.email||'').toLowerCase());
}
function applyStaffUI(){
  ['foodCouponSettingsForm','foodCouponAddExpenseBtn','foodCouponGalleryForm','foodCouponExpenseActionHead'].forEach(id=>$(id)?.classList.toggle('hidden',!staff));
}
function filePath(prefix,file){return `food-coupon/${prefix}/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(0,100)}`;}
async function upload(file,prefix){
  const path=filePath(prefix,file);
  const {error}=await supabase.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error)throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function loadSettings(){
  const {data,error}=await supabase.from('food_coupon_settings').select('*').eq('society_id',SOCIETY_ID).maybeSingle();
  if(error){$('foodCouponSettingsMessage').textContent='Unable to load collection details: '+error.message;return;}
  currentSettings=data||{society_id:SOCIETY_ID,total_collection:0,collection_pdf_url:null};
  $('foodCouponTotal').textContent=money(currentSettings.total_collection);
  $('foodCouponTotalInput').value=Number(currentSettings.total_collection||0).toFixed(2);
  const root=$('foodCouponPdfViewer');
  if(currentSettings.collection_pdf_url){
    const url=esc(currentSettings.collection_pdf_url);
    root.classList.remove('empty-state');
    root.innerHTML=`<a href="${url}" target="_blank" rel="noopener">Open / download collection PDF (${esc(currentSettings.collection_pdf_name||'Collection statement.pdf')})</a><iframe src="${url}#toolbar=1&navpanes=0" title="Food coupon collection PDF" loading="lazy"></iframe>`;
  }else{root.classList.add('empty-state');root.textContent='No collection PDF uploaded yet.';}
}
async function saveSettings(event){
  event.preventDefault();
  if(!staff)return;
  const message=$('foodCouponSettingsMessage'),button=$('foodCouponSettingsForm').querySelector('button[type=submit');
  const total=Number($('foodCouponTotalInput').value),file=$('foodCouponPdf').files?.[0];
  if(!Number.isFinite(total)||total<0){message.textContent='Enter a valid non-negative total collection.';return;}
  if(file&&(!isAllowedFile(file,['application/pdf']))){message.textContent='Please choose a PDF file up to 10 MB.';return;}
  button.disabled=true;message.textContent='Saving collection details…';
  try{
    let url=currentSettings?.collection_pdf_url||null,name=currentSettings?.collection_pdf_name||null;
    if(file){url=await upload(file,'collection');name=file.name;}
    const payload={society_id:SOCIETY_ID,total_collection:total,collection_pdf_url:url,collection_pdf_name:name,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('food_coupon_settings').upsert(payload,{onConflict:'society_id'});
    if(error)throw error;
    $('foodCouponPdf').value='';message.textContent='Collection details saved.';await loadSettings();
  }catch(error){console.error('Food coupon settings save failed',error);message.textContent='Save failed: '+(error?.message||String(error));}
  finally{button.disabled=false;}
}
function resetExpenseForm(){
  $('foodCouponExpenseForm').reset();$('foodCouponExpenseId').value='';
  $('foodCouponExpenseDate').value=new Date().toISOString().slice(0,10);
  $('foodCouponExpenseMessage').textContent='';
}
function beginEditExpense(row){
  if(!staff)return;
  $('foodCouponExpenseId').value=row.id;
  $('foodCouponExpenseName').value=row.expense_name||'';
  $('foodCouponExpenseDate').value=String(row.expense_date||'').slice(0,10);
  $('foodCouponExpenseAmount').value=Number(row.amount||0);
  $('foodCouponExpenseStatus').value=row.status||'Pending';
  $('foodCouponExpenseBill').value='';
  $('foodCouponExpenseForm').classList.remove('hidden');
  $('foodCouponExpenseMessage').textContent='Editing expense. Uploading a new bill will replace the displayed bill link.';
  $('foodCouponExpenseForm').scrollIntoView({behavior:'smooth',block:'center'});
}
async function loadExpenses(){
  const body=$('foodCouponExpensesBody');
  const {data,error}=await supabase.from('food_coupon_expenses').select('*').eq('society_id',SOCIETY_ID).order('expense_date',{ascending:false}).order('created_at',{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan="6">Unable to load expenses: ${esc(error.message)}</td></tr>`;return;}
  if(!data?.length){body.innerHTML='<tr><td colspan="6" class="muted">No food coupon expenses added yet.</td></tr>';return;}
  body.innerHTML=data.map(row=>`<tr><td>${esc(row.expense_name)}</td><td>${esc(row.expense_date||'—')}</td><td>${money(row.amount)}</td><td><span class="status ${row.status==='Clear'?'paid':'progress-status'}">${esc(row.status)}</span></td><td>${row.bill_url?`<a href="${esc(row.bill_url)}" target="_blank" rel="noopener">View bill</a>`:'<span class="muted">No bill</span>'}</td>${staff?`<td><button class="secondary food-coupon-edit-expense" data-id="${esc(row.id)}" type="button">Edit</button></td>`:''}</tr>`).join('');
  if(staff)body.querySelectorAll('.food-coupon-edit-expense').forEach(btn=>btn.addEventListener('click',()=>{const row=data.find(x=>x.id===btn.dataset.id);if(row)beginEditExpense(row);}));
}
async function saveExpense(event){
  event.preventDefault();if(!staff)return;
  const form=$('foodCouponExpenseForm'),message=$('foodCouponExpenseMessage'),button=form.querySelector('button[type=submit]');
  const id=$('foodCouponExpenseId').value,name=$('foodCouponExpenseName').value.trim(),date=$('foodCouponExpenseDate').value,amount=Number($('foodCouponExpenseAmount').value),status=$('foodCouponExpenseStatus').value,file=$('foodCouponExpenseBill').files?.[0];
  if(!name||!date||!Number.isFinite(amount)||amount<0){message.textContent='Please enter a name, date and valid amount.';return;}
  if(file&&!isAllowedFile(file,['application/pdf','image/jpeg','image/png','image/webp'])){message.textContent='Bill must be PDF/JPG/PNG/WEBP and 10 MB or smaller.';return;}
  button.disabled=true;message.textContent='Saving expense…';
  try{
    const oldBillUrl=id?((await supabase.from('food_coupon_expenses').select('bill_url,bill_name').eq('id',id).maybeSingle()).data||{}):{};
    const billUrl=file?await upload(file,'bills'):(oldBillUrl.bill_url||null);
    const payload={society_id:SOCIETY_ID,expense_name:name,expense_date:date,amount,status,bill_url:billUrl,bill_name:file?file.name:(oldBillUrl.bill_name||null),updated_at:new Date().toISOString()};
    const result=id?await supabase.from('food_coupon_expenses').update(payload).eq('id',id):await supabase.from('food_coupon_expenses').insert(payload);
    if(result.error)throw result.error;
    message.textContent='Expense saved.';resetExpenseForm();form.classList.add('hidden');await loadExpenses();
  }catch(error){console.error('Food coupon expense save failed',error);message.textContent='Save failed: '+(error?.message||String(error));}
  finally{button.disabled=false;}
}
async function loadGallery(){
  const root=$('foodCouponGallery');
  const {data,error}=await supabase.from('food_coupon_gallery').select('*').eq('society_id',SOCIETY_ID).order('created_at',{ascending:false});
  if(error){root.innerHTML=`<div class="empty-state">Unable to load gallery: ${esc(error.message)}</div>`;return;}
  if(!data?.length){root.innerHTML='<div class="empty-state">No photos uploaded yet.</div>';return;}
  root.innerHTML=data.map(item=>`<a href="${esc(item.image_url)}" target="_blank" rel="noopener" title="${esc(item.image_name||'Food coupon gallery image')}"><img src="${esc(item.image_url)}" alt="${esc(item.image_name||'Food coupon gallery image')}" loading="lazy"/></a>`).join('');
}
async function uploadGalleryImage(event){
  event.preventDefault();if(!staff)return;
  const input=$('foodCouponGalleryImage'),file=input.files?.[0],message=$('foodCouponGalleryMessage'),button=$('foodCouponGalleryForm').querySelector('button[type=submit]');
  if(!isAllowedFile(file,['image/jpeg','image/png','image/webp'])){message.textContent='Choose a JPG, PNG or WEBP image up to 10 MB.';return;}
  button.disabled=true;message.textContent='Uploading photo…';
  try{
    const url=await upload(file,'gallery');
    const {error}=await supabase.from('food_coupon_gallery').insert({society_id:SOCIETY_ID,image_url:url,image_name:file.name});
    if(error)throw error;
    input.value='';message.textContent='Photo uploaded.';await loadGallery();
  }catch(error){console.error('Food coupon gallery upload failed',error);message.textContent='Upload failed: '+(error?.message||String(error));}
  finally{button.disabled=false;}
}
async function init(){
  if(!$('page-food-coupon'))return;
  staff=await getStaffStatus();applyStaffUI();
  $('foodCouponSettingsForm').addEventListener('submit',saveSettings);
  $('foodCouponExpenseForm').addEventListener('submit',saveExpense);
  $('foodCouponGalleryForm').addEventListener('submit',uploadGalleryImage);
  $('foodCouponAddExpenseBtn').addEventListener('click',()=>{$('foodCouponExpenseForm').classList.remove('hidden');resetExpenseForm();});
  $('foodCouponCancelExpense').addEventListener('click',()=>{$('foodCouponExpenseForm').classList.add('hidden');resetExpenseForm();});
  await Promise.all([loadSettings(),loadExpenses(),loadGallery()]);
  supabase.auth.onAuthStateChange(()=>setTimeout(async()=>{staff=await getStaffStatus();applyStaffUI();await Promise.all([loadSettings(),loadExpenses(),loadGallery()]);},200));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
