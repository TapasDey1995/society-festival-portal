import jsPDF from 'https://esm.sh/jspdf@2.5.2';
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);

function isAdmin(){
  const profile=window.portalProfile;
  return !!profile && profile.role==='admin';
}

async function generateCollectionStatusPdf(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session || !isAdmin()){
    alert('Admin login required.');
    return;
  }
  const [{data:members,error:memberError},{data:collections,error:collectionError}]=await Promise.all([
    supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID).order('block_no').order('flat_no'),
    supabase.from('collections').select('member_id,status').neq('status','Cancelled')
  ]);
  if(memberError){alert('Unable to load flat owners: '+memberError.message);return;}
  if(collectionError){alert('Unable to load collection status: '+collectionError.message);return;}

  const paid=new Set((collections||[]).filter(x=>String(x.status||'').toLowerCase()==='paid' && x.member_id).map(x=>x.member_id));
  const rows=(members||[]).map((m,i)=>[i+1,m.block_no||'',m.flat_no||'',m.name||'',paid.has(m.id)?'Paid':'',paid.has(m.id)?'Paid':'']);

  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFontSize(16);
  doc.text('Meena Orchid Festival Collection Status',148.5,14,{align:'center'});
  doc.setFontSize(9);
  doc.text('Paid flats are marked in green. Unpaid flats are marked in yellow.',148.5,20,{align:'center'});

  autoTable(doc,{
    startY:25,
    head:[['Sr No','Block','Flat','Owner Name','Status','Amount']],
    body:rows,
    theme:'grid',
    styles:{fontSize:9,cellPadding:3,valign:'middle'},
    headStyles:{fontStyle:'bold',halign:'center'},
    columnStyles:{0:{halign:'center',cellWidth:16},1:{halign:'center',cellWidth:22},2:{halign:'center',cellWidth:22},3:{cellWidth:105},4:{halign:'center',cellWidth:25},5:{halign:'center',cellWidth:30}},
    didParseCell: function(data){
      if(data.section==='body'){
        const isPaid=rows[data.row.index]?.[4]==='Paid';
        data.cell.styles.fillColor=isPaid?[198,239,206]:[255,242,204];
        if(data.column.index===4 && !isPaid) data.cell.text=[''];
        if(data.column.index===5) data.cell.text=[''];
      }
    }
  });
  doc.save('Meena_Orchid_Collection_Status.pdf');
}

function init(){
  const panel=document.querySelector('#page-collections .quick-actions');
  if(!panel || $('generateCollectionStatusPdf'))return;
  const b=document.createElement('button');
  b.id='generateCollectionStatusPdf';
  b.type='button';
  b.className='secondary hidden';
  b.textContent='Generate Collection Status PDF';
  panel.appendChild(b);
  b.addEventListener('click',generateCollectionStatusPdf);
  const refresh=()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      b.classList.toggle('hidden',!(session && isAdmin()));
    });
  };
  refresh();
  supabase.auth.onAuthStateChange(()=>setTimeout(refresh,100));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
