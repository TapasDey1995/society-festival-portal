import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const BUCKET='festival-documents';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);

function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));}
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

async function getProfile(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return null;
  const {data}=await supabase.from('user_profiles').select('role,society_id').eq('id',session.user.id).maybeSingle();
  if(data)return data;
  if(session.user.email==='tapas@meenaorchid.local')return {role:'admin',society_id:SOCIETY_ID};
  if(session.user.email==='committee@meenaorchid.local')return {role:'committee',society_id:SOCIETY_ID};
  return null;
}

async function refreshAdminPanel(){
  const panel=$('porikromaAdminPanel');
  if(!panel)return;
  const profile=await getProfile();
  panel.classList.toggle('hidden',!isStaff(profile));
}

function injectAdminPaymentPdfButton(){
  if($('adminFlatPaymentPdfBtn'))return;
  const page=$('page-collections');
  if(!page)return false;
  const wrap=document.createElement('div');
  wrap.id='adminFlatPaymentPdfWrap';
  wrap.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin:0 0 14px;';
  wrap.innerHTML='<button id="adminFlatPaymentPdfBtn" type="button" class="secondary hidden">Import Flat Owner Payment PDF</button><span id="adminFlatPaymentPdfMessage" class="muted" style="align-self:center"></span>';
  const head=page.querySelector('.section-head');
  if(head)head.insertAdjacentElement('afterend',wrap);else{const card=page.querySelector('.card');if(card)card.insertBefore(wrap,card.firstChild);else return false;}
  $('adminFlatPaymentPdfBtn').addEventListener('click',generateFlatPaymentPdf);
  return true;
}

async function refreshFlatPaymentPdfButton(){
  if(!injectAdminPaymentPdfButton())return;
  const button=$('adminFlatPaymentPdfBtn');
  const profile=await getProfile();
  button.classList.toggle('hidden',profile?.role!=='admin');
}

function drawTableRow(doc,row,y,fill){
  const x=[14,28,58,84,162,195];
  const widths=[14,30,26,78,33,0];
  if(fill){doc.setFillColor(220,252,231);doc.rect(14,y-5,182,7,'F');}
  doc.setTextColor(30,30,30);doc.setFontSize(8.5);
  doc.text(String(row.sr),17,y);
  doc.text(String(row.block||''),30,y);
  doc.text(String(row.flat||''),60,y);
  const owner=String(row.owner||'').slice(0,52);
  doc.text(owner,86,y);
  if(row.status==='Paid')doc.text('Paid',165,y);
  if(row.amount)doc.text(String(row.amount),181,y,{align:'right'});
  doc.setDrawColor(225,225,225);doc.line(14,y+2,196,y+2);
}

async function generateFlatPaymentPdf(){
  const button=$('adminFlatPaymentPdfBtn'),message=$('adminFlatPaymentPdfMessage');
  const profile=await getProfile();
  if(profile?.role!=='admin'){if(message)message.textContent='Admin access required.';return;}
  if(button)button.disabled=true;
  if(message)message.textContent='Preparing PDF...';
  try{
    const [masterRes,membersRes,collectionsRes]=await Promise.all([
      supabase.from('flat_owner_master').select('block_no,flat_no,owner_name').eq('society_id',SOCIETY_ID).order('block_no').order('flat_no'),
      supabase.from('members').select('id,block_no,flat_no').eq('society_id',SOCIETY_ID),
      supabase.from('collections').select('member_id,amount,status').eq('status','Paid')
    ]);
    if(masterRes.error)throw masterRes.error;
    if(membersRes.error)throw membersRes.error;
    if(collectionsRes.error)throw collectionsRes.error;
    const memberKeyById=new Map((membersRes.data||[]).map(m=>[m.id,`${String(m.block_no||'').trim().toLowerCase()}|${String(m.flat_no||'').trim().toLowerCase()}`]));
    const paidByFlat=new Map();
    (collectionsRes.data||[]).forEach(c=>{
      const key=memberKeyById.get(c.member_id);if(!key)return;
      paidByFlat.set(key,(paidByFlat.get(key)||0)+Number(c.amount||0));
    });
    const rows=(masterRes.data||[]).map((m,i)=>{
      const key=`${String(m.block_no||'').trim().toLowerCase()}|${String(m.flat_no||'').trim().toLowerCase()}`;
      const amount=paidByFlat.get(key)||0;
      return{sr:i+1,block:m.block_no,flat:m.flat_no,owner:m.owner_name,status:amount>0?'Paid':'',amount:amount>0?`₹${amount.toLocaleString('en-IN',{maximumFractionDigits:2})}`:''};
    });
    const paidCount=rows.filter(r=>r.status==='Paid').length;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const pageWidth=210;
    let pageNo=1,y=20;
    const header=()=>{
      doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Meena Orchid — Flat Owner Payment Status',pageWidth/2,12,{align:'center'});
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`Total Flats: ${rows.length}   Paid: ${paidCount}`,pageWidth/2,17,{align:'center'});
      doc.setFillColor(245,245,245);doc.rect(14,22,182,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);
      doc.text('Sr No',17,27);doc.text('Block',30,27);doc.text('Flat',60,27);doc.text('Owner Name',86,27);doc.text('Status',165,27);doc.text('Amount',194,27,{align:'right'});
      doc.setFont('helvetica','normal');y=35;
    };
    header();
    rows.forEach(row=>{
      if(y>282){doc.setFontSize(7);doc.text(`Page ${pageNo}`,105,291,{align:'center'});pageNo++;doc.addPage();header();}
      drawTableRow(doc,row,y,row.status==='Paid');y+=7;
    });
    doc.setFontSize(7);doc.setTextColor(100,100,100);doc.text(`Page ${pageNo}`,105,291,{align:'center'});
    doc.save(`Meena-Orchid-Flat-Payment-Status-${new Date().toISOString().slice(0,10)}.pdf`);
    if(message)message.textContent='PDF generated successfully.';
  }catch(error){console.error('Flat payment PDF error:',error);if(message)message.textContent='Unable to generate PDF: '+(error?.message||error);}
  finally{if(button)button.disabled=false;}
}

async function init(){
  const form=$('porikromaAdminForm');
  const message=$('porikromaMessage');
  await refreshAdminPanel();
  await refreshFlatPaymentPdfButton();
  if(form){
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const profile=await getProfile();
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
  supabase.auth.onAuthStateChange(()=>{setTimeout(async()=>{await refreshAdminPanel();await refreshFlatPaymentPdfButton();},150);});
  const observer=new MutationObserver(()=>refreshFlatPaymentPdfButton());
  observer.observe(document.body,{childList:true,subtree:true});
  await loadGallery();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
