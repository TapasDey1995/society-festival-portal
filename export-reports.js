import * as XLSX from 'https://esm.sh/xlsx@0.18.5?bundle';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const SOCIETY_ID='5917571c-e36e-44b1-898a-212b8989c6ff';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const amount=n=>Number(n||0);
const date=v=>{if(!v)return '';const [y,m,d]=String(v).split('-');return d&&m&&y?`${d}/${m}/${y}`:v;};

function expenseNumbers(x){
  const total=amount(x.total_amount),advance=amount(x.advance_amount),status=x.expense_status||'Pending';
  return status==='Clear'?{done:total,remaining:0}:{done:advance,remaining:Math.max(0,total-advance)};
}

function makeButton(id,label){
  if($(id))return $(id);
  const b=document.createElement('button');
  b.id=id;b.type='button';b.className='secondary';b.textContent=label;b.dataset.exportButton='1';
  return b;
}

function createExportButtons(){
  const collectionPanel=document.querySelector('#page-collections .quick-actions');
  const expensePanel=document.querySelector('#page-expenses .quick-actions');
  if(collectionPanel&&!$('downloadCollectionsExcel')){
    const b=makeButton('downloadCollectionsExcel','Download Excel');
    collectionPanel.insertBefore(b,collectionPanel.firstChild);
    b.addEventListener('click',downloadCollections);
  }
  if(expensePanel&&!$('downloadExpensesExcel')){
    const b=makeButton('downloadExpensesExcel','Download Full Expense Report');
    expensePanel.insertBefore(b,expensePanel.firstChild);
    b.addEventListener('click',downloadExpenses);
  }
}

async function ensureLoggedIn(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){alert('Please login first to download reports.');return false;}
  return true;
}

function styleWorkbook(ws,cols){ws['!cols']=cols.map(wch=>({wch}));}
function setHyperlink(ws,cell,url){if(url&&ws[cell])ws[cell].l={Target:url,Tooltip:'Open supporting document'};}

async function downloadCollections(){
  if(!await ensureLoggedIn())return;
  // collections table does not have society_id; scope records through its member/festival relationships.
  const [{data,error},{data:members},{data:festivals}]=await Promise.all([
    supabase.from('collections').select('*').order('collection_date',{ascending:true}).order('created_at',{ascending:true}),
    supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID),
    supabase.from('festivals').select('id,name').eq('society_id',SOCIETY_ID)
  ]);
  if(error){alert('Unable to load collection records: '+error.message);return;}
  const memberIds=new Set((members||[]).map(x=>x.id));
  const festivalIds=new Set((festivals||[]).map(x=>x.id));
  const mm=new Map((members||[]).map(x=>[x.id,x]));
  const fm=new Map((festivals||[]).map(x=>[x.id,x.name]));
  const filtered=(data||[]).filter(x=>(x.member_id&&memberIds.has(x.member_id))||(x.festival_id&&festivalIds.has(x.festival_id)));
  const rows=[['Sr No','Date','Festival','Block','Flat','Name','Amount','Payment Mode','Status','Receipt No','Transaction ID','Collection Type','Receipt / File','Receipt Download']];
  const links=[];
  filtered.forEach((x,i)=>{
    const receipt=x.receipt_url||x.file_upload_url||'';
    const download=x.receipt_download_url||receipt;
    rows.push([i+1,date(x.collection_date),fm.get(x.festival_id)||'',mm.get(x.member_id)?.block_no||'',mm.get(x.member_id)?.flat_no||'',mm.get(x.member_id)?.name||x.notes||'',amount(x.amount),x.payment_mode||'',x.status||'',x.receipt_no||'',x.transaction_id||'',x.collection_type||'',receipt?'Open receipt':'',download?'Download receipt':'']);
    links.push({row:i+2,receipt,download});
  });
  if(rows.length===1)rows.push(['','','No collection records','','','','','','','','','','','']);
  const ws=XLSX.utils.aoa_to_sheet(rows);styleWorkbook(ws,[8,14,22,12,12,30,16,18,14,18,24,28,20,20]);
  links.forEach(x=>{setHyperlink(ws,`M${x.row}`,x.receipt);setHyperlink(ws,`N${x.row}`,x.download);});
  ws['!freeze']={xSplit:0,ySplit:1};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'All Collections');XLSX.writeFile(wb,'Meena_Orchid_All_Collections.xlsx');
}

async function downloadExpenses(){
  if(!await ensureLoggedIn())return;
  // expenses table does not have society_id; festival_id identifies the society's festival categories.
  const [{data,error},{data:festivals}]=await Promise.all([
    supabase.from('expenses').select('*').order('expense_date',{ascending:true}).order('created_at',{ascending:true}),
    supabase.from('festivals').select('id,name').eq('society_id',SOCIETY_ID)
  ]);
  if(error){alert('Unable to load expense records: '+error.message);return;}
  const fm=new Map((festivals||[]).map(x=>[x.id,x.name]));
  const festivalIds=new Set((festivals||[]).map(x=>x.id));
  const source=(data||[]).filter(x=>!x.festival_id||festivalIds.has(x.festival_id));
  const total=source.reduce((a,x)=>a+amount(x.total_amount),0);
  const done=source.reduce((a,x)=>a+expenseNumbers(x).done,0);
  const remaining=source.reduce((a,x)=>a+expenseNumbers(x).remaining,0);
  const rows=[
    ['Meena Orchid Festival Transparency Portal — Full Expense Report'],
    ['Generated Date',new Date().toLocaleString('en-IN')],
    ['Total Expenses',total],
    ['Expenses Done',done],
    ['Remaining',remaining],
    [],
    ['Sr No','Festival / Category','Date','Expense Name','Total Amount','Advance','Expenses Done','Remaining','Status','Bill / Receipt']
  ];
  const links=[];
  source.forEach((x,i)=>{const n=expenseNumbers(x);rows.push([i+1,fm.get(x.festival_id)||'',date(x.expense_date),x.expense_name||'',amount(x.total_amount),amount(x.advance_amount),n.done,n.remaining,x.expense_status||'Pending',x.bill_url?'Open bill':'']);if(x.bill_url)links.push({row:rows.length,url:x.bill_url});});
  if(!source.length)rows.push(['','No expense records','','','','','','','','']);
  const ws=XLSX.utils.aoa_to_sheet(rows);styleWorkbook(ws,[8,24,14,36,16,16,18,16,14,65]);
  links.forEach(x=>setHyperlink(ws,`J${x.row}`,x.url));
  ws['!freeze']={xSplit:0,ySplit:7};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Expense Report');XLSX.writeFile(wb,'Meena_Orchid_Full_Expense_Report.xlsx');
}

function updateExportVisibility(){
  supabase.auth.getSession().then(({data:{session}})=>{
    createExportButtons();
    document.querySelectorAll('[data-export-button]').forEach(b=>b.classList.toggle('hidden',!session));
  });
}

function init(){
  createExportButtons();
  updateExportVisibility();
  supabase.auth.onAuthStateChange(()=>setTimeout(updateExportVisibility,100));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
