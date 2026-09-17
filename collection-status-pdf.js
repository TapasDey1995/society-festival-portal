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
  return role==='admin'||role==='committee'||session.user.email==='tapas@meenaorchid.local'||session.user.email==='committee@meenaorchid.local';
}

async function generateCollectionStatusPdf(){
  if(!(await getAccess())){alert('Admin or Committee login required.');return;}

  const [{data:members,error:membersError},{data:collections,error:collectionsError}]=await Promise.all([
    supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID).order('block_no').order('flat_no'),
    supabase.from('collections').select('member_id,block_no,flat_no,notes,status,amount').neq('status','Cancelled')
  ]);

  if(membersError){alert('Unable to load the master flat list: '+membersError.message);return;}
  if(collectionsError){alert('Unable to load the collection list: '+collectionsError.message);return;}

  // Master table is the source of truth for all flats. Collection table is only used to determine payment.
  const paidByMember=new Map();
  const paidByFlat=new Map();
  const normalise=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,'');
  const flatKey=(block,flat)=>`${normalise(block)}|${normalise(flat)}`;

  (collections||[]).forEach(c=>{
    if(String(c.status||'').toLowerCase()!=='paid')return;
    const amount=Number(c.amount||0);
    if(c.member_id){
      paidByMember.set(c.member_id,(paidByMember.get(c.member_id)||0)+amount);
    }
    if(c.block_no!=null&&c.flat_no!=null){
      const key=flatKey(c.block_no,c.flat_no);
      paidByFlat.set(key,(paidByFlat.get(key)||0)+amount);
    }
  });

  const rows=(members||[]).map((m,i)=>{
    const key=flatKey(m.block_no,m.flat_no);
    const memberAmount=paidByMember.get(m.id);
    const flatAmount=paidByFlat.get(key);
    const amount=memberAmount!=null?memberAmount:(flatAmount||0);
    const paid=amount>0 || paidByMember.has(m.id) || paidByFlat.has(key);
    return [i+1,m.flat_no||'',m.block_no||'',m.name||'',paid?'Paid':'',paid?amount.toFixed(2):''];
  });

  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFontSize(16);
  doc.text('Meena Orchid Festival Collection Status',148.5,14,{align:'center'});
  doc.setFontSize(9);
  doc.text(`Master Flat List: ${rows.length} flats`,148.5,20,{align:'center'});

  autoTable(doc,{
    startY:25,
    head:[['Sr No','Flat','Block','Name','Status','Amount']],
    body:rows,
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
        const paid=rows[data.row.index]?.[4]==='Paid';
        data.cell.styles.fillColor=paid?[198,239,206]:[255,242,204];
      }
    }
  });

  doc.save('Meena_Orchid_Collection_Status_137_Flats.pdf');
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