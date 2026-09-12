import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const money=n=>Number(n||0);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function date(v){if(!v)return '';const [y,m,d]=String(v).split('-');return d&&m&&y?`${d}/${m}/${y}`:v;}
function expenseNumbers(x){
  const total=money(x.total_amount),advance=money(x.advance_amount),status=x.expense_status||'Pending';
  return status==='Clear'?{done:total,remaining:0}:{done:advance,remaining:Math.max(0,total-advance)};
}
function downloadWorkbook(rows,filename,sheetName){
  if(!window.XLSX){alert('Excel export is still loading. Please try again.');return;}
  const ws=XLSX.utils.json_to_sheet(rows,{skipHeader:false});
  ws['!cols']=Object.keys(rows[0]||{}).map(k=>({wch:Math.min(55,Math.max(14,k.length+3))}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  XLSX.writeFile(wb,filename);
}

async function ensureLoggedIn(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){alert('Please login first to download reports.');return false;}
  return true;
}

async function downloadCollections(){
  if(!await ensureLoggedIn())return;
  const {data,error}=await supabase.from('collections').select('*').eq('society_id',SOCIETY_ID).order('collection_date',{ascending:true}).order('created_at',{ascending:true});
  if(error){alert('Unable to load collection records: '+error.message);return;}
  const {data:members}=await supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID);
  const {data:festivals}=await supabase.from('festivals').select('id,name').eq('society_id',SOCIETY_ID);
  const mm=new Map((members||[]).map(x=>[x.id,x]));
  const fm=new Map((festivals||[]).map(x=>[x.id,x.name]));
  const rows=(data||[]).map((x,i)=>({
    'Sr No':i+1,
    'Date':date(x.collection_date),
    'Festival':fm.get(x.festival_id)||'',
    'Block':mm.get(x.member_id)?.block_no||'',
    'Flat':mm.get(x.member_id)?.flat_no||'',
    'Name':mm.get(x.member_id)?.name||x.notes||'',
    'Amount':money(x.amount),
    'Payment Mode':x.payment_mode||'',
    'Status':x.status||'',
    'Receipt No':x.receipt_no||'',
    'Transaction ID':x.transaction_id||'',
    'Collection Type':x.collection_type||'',
    'Receipt / File':x.receipt_url||x.file_upload_url||'',
    'Receipt Download':x.receipt_download_url||x.receipt_url||x.file_upload_url||''
  }));
  if(!rows.length)rows.push({'Sr No':'','Date':'','Festival':'No collection records','','Block':'','Flat':'','Name':'','Amount':'','Payment Mode':'','Status':'','Receipt No':'','Transaction ID':'','Collection Type':'','Receipt / File':'','Receipt Download':''});
  downloadWorkbook(rows,'Meena_Orchid_All_Collections.xlsx','All Collections');
}

async function downloadExpenses(){
  if(!await ensureLoggedIn())return;
  const {data,error}=await supabase.from('expenses').select('*').eq('society_id',SOCIETY_ID).order('expense_date',{ascending:true}).order('created_at',{ascending:true});
  if(error){alert('Unable to load expense records: '+error.message);return;}
  const {data:festivals}=await supabase.from('festivals').select('id,name').eq('society_id',SOCIETY_ID);
  const fm=new Map((festivals||[]).map(x=>[x.id,x.name]));
  const source=data||[];
  const total=source.reduce((a,x)=>a+money(x.total_amount),0);
  const done=source.reduce((a,x)=>a+expenseNumbers(x).done,0);
  const remaining=source.reduce((a,x)=>a+expenseNumbers(x).remaining,0);
  const rows=[];
  rows.push({'Expense Report':'Meena Orchid Festival Transparency Portal','','','','','','','','',''});
  rows.push({'Expense Report':'Generated Date', '':new Date().toLocaleString('en-IN'),'','','','','','','',''});
  rows.push({'Expense Report':'Total Expenses', '':total,'','','','','','','',''});
  rows.push({'Expense Report':'Expenses Done', '':done,'','','','','','','',''});
  rows.push({'Expense Report':'Remaining', '':remaining,'','','','','','','',''});
  rows.push({});
  source.forEach((x,i)=>{
    const n=expenseNumbers(x);
    rows.push({
      'Sr No':i+1,
      'Festival / Category':fm.get(x.festival_id)||'',
      'Date':date(x.expense_date),
      'Expense Name':x.expense_name||'',
      'Total Amount':money(x.total_amount),
      'Advance':money(x.advance_amount),
      'Expenses Done':n.done,
      'Remaining':n.remaining,
      'Status':x.expense_status||'Pending',
      'Bill / Receipt':x.bill_url||''
    });
  });
  if(!source.length)rows.push({'Sr No':'','Festival / Category':'No expense records','Date':'','Expense Name':'','Total Amount':'','Advance':'','Expenses Done':'','Remaining':'','Status':'','Bill / Receipt':''});
  if(window.XLSX){
    const ws=XLSX.utils.json_to_sheet(rows,{skipHeader:false});
    ws['!cols']=[{wch:8},{wch:24},{wch:14},{wch:34},{wch:16},{wch:16},{wch:18},{wch:16},{wch:14},{wch:65}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Expense Report');XLSX.writeFile(wb,'Meena_Orchid_Full_Expense_Report.xlsx');
  }
}

function updateExportVisibility(){
  supabase.auth.getSession().then(({data:{session}})=>{
    $('downloadCollectionsExcel')?.classList.toggle('hidden',!session);
    $('downloadExpensesExcel')?.classList.toggle('hidden',!session);
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  $('downloadCollectionsExcel')?.addEventListener('click',downloadCollections);
  $('downloadExpensesExcel')?.addEventListener('click',downloadExpenses);
  updateExportVisibility();
  supabase.auth.onAuthStateChange(()=>setTimeout(updateExportVisibility,100));
});
