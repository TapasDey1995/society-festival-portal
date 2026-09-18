import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

async function getAccess(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return false;
  const {data}=await supabase.from('user_profiles').select('role').eq('id',session.user.id).maybeSingle();
  const role=String(data?.role||'').toLowerCase();
  return ['admin','treasurer','committee'].includes(role)||session.user.email==='tapas@meenaorchid.local'||session.user.email==='committee@meenaorchid.local';
}

async function generateCollectionStatusPdf(){
  if(!(await getAccess())){alert('Admin or Committee login required.');return;}

  // PDF order:
  // 1) Every paid Flat-wise 2026 collection record, exactly as represented in Collection List, in GREEN.
  // 2) All master flat-owner records that did NOT match any of those collection records, in YELLOW.
  const [
    {data:master,error:masterError},
    {data:collections,error:collectionsError},
    {data:members,error:membersError}
  ]=await Promise.all([
    supabase.from('flat_owner_master').select('id,block_no,flat_no,owner_name').eq('society_id',SOCIETY_ID).order('block_no').order('flat_no'),
    supabase.from('collections').select('id,member_id,block_no,flat_no,status,amount,collection_type,notes').neq('status','Cancelled').order('receipt_no'),
    supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID)
  ]);

  if(masterError){alert('Unable to load the master flat list: '+masterError.message);return;}
  if(collectionsError){alert('Unable to load the collection list: '+collectionsError.message);return;}
  if(membersError){alert('Unable to load member mapping: '+membersError.message);return;}

  const normalise=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,'');
  const normaliseBlock=v=>{const s=normalise(v);const m=s.match(/(?:block)?(\d+)/);return m?m[1]:s;};
  const flatKey=(block,flat)=>`${normaliseBlock(block)}|${normalise(flat)}`;

  const memberById=new Map((members||[]).map(m=>[String(m.id),m]));

  // Only paid, non-donation Flat-wise collection records belong in the green section.
  // Keep EVERY record separately; do not sum/deduplicate them.
  const greenCollections=[];
  const matchedMasterKeys=new Set();

  (collections||[]).forEach(c=>{
    if(String(c.status||'').trim().toLowerCase()!=='paid')return;
    const collectionType=String(c.collection_type||'').trim().toLowerCase();
    if(collectionType==='last year carry forward')return;
    if(collectionType!=='flat wise 2026 collection')return;

    const member=c.member_id!=null?memberById.get(String(c.member_id)):null;
    const block=String(c.block_no??'').trim()||String(member?.block_no??'').trim();
    const flat=String(c.flat_no??'').trim()||String(member?.flat_no??'').trim();
    const name=String(member?.name??'').trim()||String(c.notes??'').trim();

    // A collection with Block + Flat can be compared to master.
    if(block&&flat)matchedMasterKeys.add(flatKey(block,flat));

    greenCollections.push({
      block,
      flat,
      name,
      status:'Paid',
      amount:Number(c.amount||0)
    });
  });

  // Master section contains ONLY master rows not matched by any green collection row.
  const yellowMaster=(master||[]).filter(m=>!matchedMasterKeys.has(flatKey(m.block_no,m.flat_no)));

  const rows=[];
  greenCollections.forEach((r,i)=>{
    rows.push([i+1,r.flat,r.block,r.name,r.status,r.amount.toFixed(2),'green']);
  });
  yellowMaster.forEach((m,i)=>{
    rows.push(['',m.flat_no||'',m.block_no||'',m.owner_name||'','', '', 'yellow']);
  });

  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFontSize(16);
  doc.text('Meena Orchid Festival Collection Status',148.5,14,{align:'center'});
  doc.setFontSize(9);
  doc.text(`Paid Collection Records: ${greenCollections.length} | Unmatched Master Flats: ${yellowMaster.length} | Master Total: ${(master||[]).length}`,148.5,20,{align:'center'});

  autoTable(doc,{
    startY:25,
    head:[['Sr No','Flat','Block','Name','Status','Amount']],
    body:rows.map(r=>r.slice(0,6)),
    theme:'grid',
    styles:{fontSize:9,cellPadding:3,valign:'middle'},
    headStyles:{fontStyle:'bold',halign:'center'},
    columnStyles:{
      0:{halign:'center',cellWidth:16},
      1:{halign:'center',cellWidth:24},
      2:{halign:'center',cellWidth:24},
      3:{cellWidth:105},
      4:{halign:'center',cellWidth:25},
      5:{halign:'right',cellWidth:30}
    },
    didParseCell(data){
      if(data.section==='body'){
        const kind=rows[data.row.index]?.[6];
        data.cell.styles.fillColor=kind==='green'?[198,239,206]:[255,242,204];
      }
    }
  });

  doc.save(`Meena_Orchid_Collection_Status_${(master||[]).length}_Master_Flats.pdf`);
}

function ensureButton(){
  const panel=document.querySelector('#page-collections .quick-actions');
  if(!panel)return;
  let button=document.getElementById('generateCollectionStatusPdf');
  if(!button){
    button=document.createElement('button');
    button.id='generateCollectionStatusPdf';
    button.type='button';
    button.className='secondary';
    button.textContent='Generate Collection Status PDF';
    button.addEventListener('click',generateCollectionStatusPdf);
    panel.appendChild(button);
  }
  getAccess().then(ok=>button.classList.toggle('hidden',!ok));
}

function init(){
  ensureButton();
  document.addEventListener('DOMContentLoaded',ensureButton);
  new MutationObserver(ensureButton).observe(document.body,{childList:true,subtree:true});
  setInterval(ensureButton,1000);
}

init();