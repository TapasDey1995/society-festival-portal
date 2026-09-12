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
  const total=amount(x.total_amount),advance=amount(x.advance_amount),status=String(x.expense_status||'Pending').trim().toLowerCase();
  return status==='clear'?{done:total,remaining:0}:{done:advance,remaining:Math.max(0,total-advance)};
}
function makeButton(id,label){if($(id))return $(id);const b=document.createElement('button');b.id=id;b.type='button';b.className='secondary';b.textContent=label;b.dataset.exportButton='1';return b;}
function createExportButtons(){
  const collectionPanel=document.querySelector('#page-collections .quick-actions');
  const expensePanel=document.querySelector('#page-expenses .quick-actions');
  if(collectionPanel&&!$('downloadCollectionsExcel')){const b=makeButton('downloadCollectionsExcel','Download Excel');collectionPanel.insertBefore(b,collectionPanel.firstChild);b.addEventListener('click',downloadCollections);}
  if(expensePanel&&!$('downloadExpensesExcel')){const b=makeButton('downloadExpensesExcel','Download Expense Excel');expensePanel.insertBefore(b,expensePanel.firstChild);b.addEventListener('click',downloadExpenses);}
}
async function ensureLoggedIn(){const {data:{session}}=await supabase.auth.getSession();if(!session){alert('Please login first to download reports.');return false;}return true;}
function styleWorkbook(ws,cols){ws['!cols']=cols.map(wch=>({wch}));}
function setHyperlink(ws,cell,url){if(url&&ws[cell])ws[cell].l={Target:url,Tooltip:'Open supporting document'};}
function titleStyle(ws,lastCol){
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:lastCol}}];
  if(ws.A1)ws.A1.s={font:{bold:true,sz:16},alignment:{horizontal:'center'}};
}

async function downloadCollections(){
  if(!await ensureLoggedIn())return;
  const [{data,error},{data:members,error:memberError},{data:festivals,error:festivalError}]=await Promise.all([
    supabase.from('collections').select('*').order('collection_date',{ascending:true}).order('created_at',{ascending:true}),
    supabase.from('members').select('id,block_no,flat_no,name').eq('society_id',SOCIETY_ID),
    supabase.from('festivals').select('id,name').eq('society_id',SOCIETY_ID)
  ]);
  if(error){alert('Unable to load collection records: '+error.message);return;}
  if(memberError){alert('Unable to load society members: '+memberError.message);return;}
  if(festivalError){alert('Unable to load society festivals: '+festivalError.message);return;}
  const memberIds=new Set((members||[]).map(x=>x.id));
  const festivalIds=new Set((festivals||[]).map(x=>x.id));
  const mm=new Map((members||[]).map(x=>[x.id,x]));
  const fm=new Map((festivals||[]).map(x=>[x.id,x.name]));
  const filtered=(data||[]).filter(x=>(x.member_id&&memberIds.has(x.member_id))||(x.festival_id&&festivalIds.has(x.festival_id)));
  const rows=[['Sr No','Date','Festival','Block','Flat','Name','Amount','Payment Mode','Status','Receipt No','Transaction ID','Collection Type','Receipt / File','Receipt Download']];
  const links=[];
  filtered.forEach((x,i)=>{const receipt=x.receipt_url||x.file_upload_url||'';const download=x.receipt_download_url||receipt;rows.push([i+1,date(x.collection_date),fm.get(x.festival_id)||'',mm.get(x.member_id)?.block_no||'',mm.get(x.member_id)?.flat_no||'',mm.get(x.member_id)?.name||x.notes||'',amount(x.amount),x.payment_mode||'',x.status||'',x.receipt_no||'',x.transaction_id||'',x.collection_type||'',receipt?'Open receipt':'',download?'Download receipt':'']);links.push({row:i+2,receipt,download});});
  if(rows.length===1)rows.push(['','','No collection records','','','','','','','','','','','']);
  const ws=XLSX.utils.aoa_to_sheet(rows);styleWorkbook(ws,[8,14,22,12,12,30,16,18,14,18,24,28,20,20]);links.forEach(x=>{setHyperlink(ws,`M${x.row}`,x.receipt);setHyperlink(ws,`N${x.row}`,x.download);});ws['!freeze']={xSplit:0,ySplit:1};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'All Collections');XLSX.writeFile(wb,'Meena_Orchid_All_Collections.xlsx');
}

function buildExpenseSheet(name,source){
  const total=source.reduce((a,x)=>a+amount(x.total_amount),0);
  const done=source.reduce((a,x)=>a+expenseNumbers(x).done,0);
  const remaining=source.reduce((a,x)=>a+expenseNumbers(x).remaining,0);
  const rows=[
    [name+' — Expense Report'],
    ['Total Expenses',total],
    ['Expenses Done',done],
    ['Remaining',remaining],
    [],
    ['Sr No','Date','Expense Name','Total Amount','Advance','Expenses Done','Remaining','Status','Bill / Receipt']
  ];
  const links=[];
  source.forEach((x,i)=>{
    const n=expenseNumbers(x);
    rows.push([i+1,date(x.expense_date),x.expense_name||'',amount(x.total_amount),amount(x.advance_amount),n.done,n.remaining,x.expense_status||'Pending',x.bill_url?'Open bill':'']);
    if(x.bill_url)links.push({row:rows.length,url:x.bill_url});
  });
  if(!source.length)rows.push(['','No expenses recorded','','','','','','','']);
  const ws=XLSX.utils.aoa_to_sheet(rows);
  styleWorkbook(ws,[8,14,38,18,16,18,16,14,65]);
  titleStyle(ws,8);
  links.forEach(x=>setHyperlink(ws,`I${x.row}`,x.url));
  ws['!freeze']={xSplit:0,ySplit:6};
  return ws;
}

async function downloadExpenses(){
  if(!await ensureLoggedIn())return;
  const [{data,error},{data:festivals,error:festivalError},{data:collections,error:collectionError}]=await Promise.all([
    supabase.from('expenses').select('*').order('expense_date',{ascending:true}).order('created_at',{ascending:true}),
    supabase.from('festivals').select('id,name,sort_order').eq('society_id',SOCIETY_ID).order('sort_order',{ascending:true}),
    supabase.from('collections').select('*').order('collection_date',{ascending:true})
  ]);
  if(error){alert('Unable to load expense records: '+error.message);return;}
  if(festivalError){alert('Unable to load society festivals: '+festivalError.message);return;}
  if(collectionError){alert('Unable to load collection records: '+collectionError.message);return;}

  const festivalList=['15th Aug','Ganesh Puja','Durga Puja','Lakshmi Puja'];
  const festivalIdMap=new Map((festivals||[]).map(x=>[x.id,x.name]));
  const source=(data||[]).filter(x=>x.festival_id && festivalIdMap.has(x.festival_id));
  const byFestival={};
  festivalList.forEach(name=>{byFestival[name]=source.filter(x=>festivalIdMap.get(x.festival_id)===name);});

  // Collection total = every amount currently recorded in the Collection tab.
  const totalCollection=(collections||[]).reduce((sum,x)=>sum+amount(x.amount),0);
  // For each festival, Clear expenses count the full total amount; Pending expenses count only advance paid till date.
  const festivalExpenses={};
  festivalList.forEach(name=>{
    festivalExpenses[name]=byFestival[name].reduce((sum,x)=>sum+expenseNumbers(x).done,0);
  });
  const totalExpenses=festivalList.reduce((sum,name)=>sum+festivalExpenses[name],0);
  const remainingFund=totalCollection-totalExpenses;

  const wb=XLSX.utils.book_new();
  const mainRows=[
    ['MEENA ORCHID FESTIVAL TRANSPARENCY PORTAL'],
    ['Financial Summary'],
    [],
    ['Total Collection',totalCollection],
    ['15th Aug Expenses',festivalExpenses['15th Aug']],
    ['Ganesh Puja Expenses',festivalExpenses['Ganesh Puja']],
    ['Durga Puja Expenses',festivalExpenses['Durga Puja']],
    ['Lakshmi Puja Expenses',festivalExpenses['Lakshmi Puja']],
    ['Remaining Balance',remainingFund]
  ];
  const main=XLSX.utils.aoa_to_sheet(mainRows);
  styleWorkbook(main,[42,24]);
  main['!merges']=[{s:{r:0,c:0},e:{r:0,c:1}},{s:{r:1,c:0},e:{r:1,c:1}}];
  main['!freeze']={xSplit:0,ySplit:3};
  XLSX.utils.book_append_sheet(wb,main,'Main Summary');

  festivalList.forEach(name=>XLSX.utils.book_append_sheet(wb,buildExpenseSheet(name,byFestival[name]),name.slice(0,31)));
  XLSX.writeFile(wb,'Meena_Orchid_Expense_Report.xlsx');
}
function updateExportVisibility(){supabase.auth.getSession().then(({data:{session}})=>{createExportButtons();document.querySelectorAll('[data-export-button]').forEach(b=>b.classList.toggle('hidden',!session));});}
function init(){createExportButtons();updateExportVisibility();supabase.auth.onAuthStateChange(()=>setTimeout(updateExportVisibility,100));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
