import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

async function canGeneratePdf(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return false;
  const {data}=await supabase.from('user_profiles').select('role').eq('id',session.user.id).maybeSingle();
  const role=String(data?.role||'').toLowerCase();
  return role==='admin'||role==='committee'||session.user.email==='tapas@meenaorchid.local'||session.user.email==='committee@meenaorchid.local';
}

async function generateCollectionStatusPdf(){
  if(!(await canGeneratePdf())){alert('Admin or Committee login required.');return;}
  const [{data:members,error:me},{data:collections,error:ce}]=await Promise.all([
    supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID).order('block_no').order('flat_no'),
    supabase.from('collections').select('member_id,status,amount').neq('status','Cancelled')
  ]);
  if(me){alert('Unable to load flat owners: '+me.message);return;}
  if(ce){alert('Unable to load collection status: '+ce.message);return;}

  const paidAmounts=new Map();
  (collections||[]).forEach(x=>{
    if(String(x.status||'').toLowerCase()==='paid'&&x.member_id){
      paidAmounts.set(x.member_id,(paidAmounts.get(x.member_id)||0)+Number(x.amount||0));
    }
  });

  const rows=(members||[]).map((m,i)=>{
    const amount=paidAmounts.get(m.id)||0;
    return [i+1,m.block_no||'',m.flat_no||'',m.name||'',amount>0?'Paid':'',amount>0?amount.toFixed(2):''];
  });

  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFontSize(16);
  doc.text('Meena Orchid Festival Collection Status',148.5,14,{align:'center'});
  doc.setFontSize(9);
  doc.text('Paid flats are marked in green. Unpaid flats are marked in yellow.',148.5,20,{align:'center'});
  autoTable(doc,{startY:25,head:[['Sr No','Block','Flat','Owner Name','Status','Amount']],body:rows,theme:'grid',styles:{fontSize:9,cellPadding:3,valign:'middle'},headStyles:{fontStyle:'bold',halign:'center'},columnStyles:{0:{halign:'center',cellWidth:16},1:{halign:'center',cellWidth:22},2:{halign:'center',cellWidth:22},3:{cellWidth:105},4:{halign:'center',cellWidth:25},5:{halign:'right',cellWidth:30}},didParseCell(data){
    if(data.section==='body'){
      const paidRow=rows[data.row.index]?.[4]==='Paid';
      data.cell.styles.fillColor=paidRow?[198,239,206]:[255,242,204];
      if(!paidRow&&data.column.index===4)data.cell.text=[''];
    }
  }});
  doc.save('Meena_Orchid_Collection_Status.pdf');
}

function addButton(panel){
  if(document.getElementById('generateCollectionStatusPdf'))return true;
  const b=document.createElement('button');
  b.id='generateCollectionStatusPdf';
  b.type='button';
  b.className='secondary hidden';
  b.textContent='Generate Collection Status PDF';
  panel.appendChild(b);
  b.onclick=generateCollectionStatusPdf;
  const refresh=async()=>b.classList.toggle('hidden',!(await canGeneratePdf()));
  refresh();
  supabase.auth.onAuthStateChange(()=>setTimeout(refresh,300));
  return true;
}

function init(){
  const tryAdd=()=>{
    const panel=document.querySelector('#page-collections .quick-actions');
    if(panel)addButton(panel);
  };
  tryAdd();
  document.addEventListener('DOMContentLoaded',tryAdd);
  const observer=new MutationObserver(tryAdd);
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(tryAdd,1000);
}

init();