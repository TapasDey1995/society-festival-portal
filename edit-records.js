import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const staff=()=>!$('userBadge')?.classList.contains('hidden');
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));

function parseLegacyNotes(notes){
  const parts=String(notes||'').split('|').map(x=>x.trim());
  const block=parts.find(x=>/^Block\s+/i.test(x))?.replace(/^Block\s+/i,'').trim()||'';
  const flat=parts.find(x=>/^Flat\s+/i.test(x))?.replace(/^Flat\s+/i,'').trim()||'';
  const name=parts.filter(x=>!/^Block\s+/i.test(x)&&!/^Flat\s+/i.test(x)).join(' | ').trim();
  return {block,flat,name};
}
function addButton(cell,className,text,id){const b=document.createElement('button');b.type='button';b.className=`secondary ${className}`;b.textContent=text;b.dataset.id=id;cell.appendChild(b);return b;}

async function editCollection(id){
  if(!staff()) return alert('Committee/admin login is required to edit a collection.');
  const {data,error}=await supabase.from('collections').select('*').eq('id',id).maybeSingle();
  if(error||!data) return alert('Unable to load collection for editing.');
  const legacy=parseLegacyNotes(data.notes);
  const block=prompt('Block No',data.block_no||legacy.block); if(block===null)return;
  const flat=prompt('Flat No',data.flat_no||legacy.flat); if(flat===null)return;
  const name=prompt('Name',legacy.name||''); if(name===null)return;
  const amount=prompt('Amount',String(data.amount??'')); if(amount===null)return;
  const date=prompt('Date (YYYY-MM-DD)',data.collection_date||''); if(date===null)return;
  const mode=prompt('Payment Mode (UPI / Cash / Bank Transfer / Cheque)',data.payment_mode||'UPI'); if(mode===null)return;
  const status=prompt('Status (Paid / Progress / Cancelled)',data.status||'Paid'); if(status===null)return;
  const receiptNo=prompt('Receipt No',data.receipt_no||''); if(receiptNo===null)return;
  const transactionId=prompt('Transaction ID',data.transaction_id||''); if(transactionId===null)return;
  const type=prompt('Collection Type',data.collection_type||'Flat wise 2026 collection'); if(type===null)return;
  if(!block.trim()||!flat.trim())return alert('Block No and Flat No are required.');
  const n=Number(amount); if(!Number.isFinite(n)||n<=0)return alert('Please enter a valid amount greater than 0.');
  const payload={block_no:block.trim(),flat_no:flat.trim(),notes:name.trim()||null,amount:n,collection_date:date.trim(),payment_mode:mode.trim(),status:status.trim(),receipt_no:receiptNo.trim()||null,transaction_id:transactionId.trim()||null,collection_type:type.trim()||'Flat wise 2026 collection',updated_at:new Date().toISOString()};
  const result=await supabase.from('collections').update(payload).eq('id',id);
  if(result.error)return alert('Unable to update collection: '+result.error.message);
  alert('Collection updated successfully.');
  window.location.reload();
}

async function editExpense(id){
  if(!staff()) return alert('Committee/admin login is required to edit an expense.');
  const {data,error}=await supabase.from('expenses').select('*').eq('id',id).maybeSingle();
  if(error||!data) return alert('Unable to load expense for editing.');
  const date=prompt('Date (YYYY-MM-DD)',data.expense_date||''); if(date===null)return;
  const name=prompt('Expense Name',data.expense_name||''); if(name===null)return;
  const total=prompt('Total Amount',String(data.total_amount??'')); if(total===null)return;
  const advance=prompt('Advance Amount',String(data.advance_amount??0)); if(advance===null)return;
  const status=prompt('Status (Clear / Pending)',data.expense_status||'Pending'); if(status===null)return;
  if(!name.trim())return alert('Expense name is required.');
  const totalN=Number(total),advanceN=Number(advance); if(!Number.isFinite(totalN)||totalN<=0)return alert('Please enter a valid total amount greater than 0.'); if(!Number.isFinite(advanceN)||advanceN<0)return alert('Please enter a valid advance amount.'); if(advanceN>totalN)return alert('Advance amount cannot be greater than total amount.');
  const result=await supabase.from('expenses').update({expense_date:date.trim(),expense_name:name.trim(),total_amount:totalN,advance_amount:advanceN,expense_status:status.trim()||'Pending',updated_at:new Date().toISOString()}).eq('id',id);
  if(result.error)return alert('Unable to update expense: '+result.error.message);
  alert('Expense updated successfully.');
  window.location.reload();
}

function enhanceCollections(){
  if(!staff())return;
  document.querySelectorAll('#collectionBody tr').forEach(row=>{const button=row.querySelector('.edit-collection');if(!button||row.querySelector('.edit-record-btn'))return;const cell=row.lastElementChild;if(cell)addButton(cell,'edit-record-btn','Edit',button.dataset.id).onclick=()=>editCollection(button.dataset.id);button.remove();});
}
function enhanceExpenses(){
  if(!staff())return;
  document.querySelectorAll('#expenseGroups tbody tr').forEach(row=>{if(row.querySelector('.edit-expense-btn'))return;const cells=row.children;if(cells.length<9)return;const id=(()=>{const status=cells[7].querySelector('.expense-status');return status?.dataset.id||''})();if(!id)return;const cell=document.createElement('td');cell.appendChild(Object.assign(document.createElement('button'),{type:'button',className:'secondary edit-expense-btn',textContent:'Edit'}));cell.querySelector('button').onclick=()=>editExpense(id);row.appendChild(cell);});
  document.querySelectorAll('#expenseGroups table').forEach(table=>{const head=table.querySelector('thead tr');if(head&&!head.querySelector('.edit-head')){const th=document.createElement('th');th.className='edit-head';th.textContent='Action';head.appendChild(th);}});
}
function run(){enhanceCollections();enhanceExpenses();}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>setTimeout(run,300));
