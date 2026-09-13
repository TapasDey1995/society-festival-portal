import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const staff=()=>!$('userBadge')?.classList.contains('hidden');

function parseLegacyNotes(notes){
  const parts=String(notes||'').split('|').map(x=>x.trim());
  const block=parts.find(x=>/^Block\s+/i.test(x))?.replace(/^Block\s+/i,'').trim()||'';
  const flat=parts.find(x=>/^Flat\s+/i.test(x))?.replace(/^Flat\s+/i,'').trim()||'';
  const name=parts.filter(x=>!/^Block\s+/i.test(x)&&!/^Flat\s+/i.test(x)).join(' | ').trim();
  return {block,flat,name};
}

function ensureModal(){
  if($('recordEditModal')) return $('recordEditModal');
  const style=document.createElement('style');
  style.id='recordEditModalStyle';
  style.textContent=`
    .record-edit-overlay{position:fixed;inset:0;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px;z-index:99999}
    .record-edit-overlay.hidden{display:none}
    .record-edit-modal{width:min(680px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:22px}
    .record-edit-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
    .record-edit-title h2{margin:0;font-size:22px}
    .record-edit-close{border:0;background:transparent;font-size:28px;line-height:1;cursor:pointer;color:#64748b;padding:2px 8px}
    .record-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .record-edit-field{display:flex;flex-direction:column;gap:6px}
    .record-edit-field.full{grid-column:1/-1}
    .record-edit-field label{font-size:13px;font-weight:600;color:#334155}
    .record-edit-field input,.record-edit-field select{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font:inherit}
    .record-edit-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:15px;border-top:1px solid #e2e8f0}
    .record-edit-actions button{min-width:100px}
    @media(max-width:600px){.record-edit-overlay{padding:10px}.record-edit-modal{padding:17px;border-radius:15px;max-height:95vh}.record-edit-grid{grid-template-columns:1fr}.record-edit-field.full{grid-column:auto}.record-edit-title h2{font-size:19px}}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.id='recordEditModal';
  overlay.className='record-edit-overlay hidden';
  overlay.innerHTML=`
    <div class="record-edit-modal" role="dialog" aria-modal="true" aria-labelledby="recordEditTitle">
      <div class="record-edit-title">
        <h2 id="recordEditTitle">Edit Record</h2>
        <button type="button" class="record-edit-close" id="recordEditClose" aria-label="Close">&times;</button>
      </div>
      <form id="recordEditForm">
        <div id="recordEditFields" class="record-edit-grid"></div>
        <div class="record-edit-actions">
          <button type="button" class="secondary" id="recordEditCancel">Cancel</button>
          <button type="submit" class="primary" id="recordEditSave">Update</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  $('recordEditClose').onclick=closeModal;
  $('recordEditCancel').onclick=closeModal;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.classList.contains('hidden'))closeModal();});
  return overlay;
}

function closeModal(){
  const modal=$('recordEditModal');
  if(modal) modal.classList.add('hidden');
}

function field(label,id,value='',type='text',options=[],full=false){
  const wrap=document.createElement('div');
  wrap.className='record-edit-field'+(full?' full':'');
  const lab=document.createElement('label');
  lab.htmlFor=id; lab.textContent=label;
  wrap.appendChild(lab);
  let el;
  if(type==='select'){
    el=document.createElement('select');
    options.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});
  }else{
    el=document.createElement('input');
    el.type=type;
  }
  el.id=id; el.name=id; el.value=value??'';
  wrap.appendChild(el);
  return wrap;
}

function openModal(title,fields,submit){
  const modal=ensureModal();
  $('recordEditTitle').textContent=title;
  const container=$('recordEditFields');
  container.innerHTML='';
  fields.forEach(f=>container.appendChild(field(f.label,f.id,f.value,f.type,f.options,f.full)));
  modal.classList.remove('hidden');
  setTimeout(()=>$(fields[0]?.id)?.focus(),50);
  $('recordEditForm').onsubmit=async e=>{e.preventDefault();const btn=$('recordEditSave');btn.disabled=true;btn.textContent='Updating...';try{await submit(Object.fromEntries(new FormData(e.target).entries()));}finally{btn.disabled=false;btn.textContent='Update';}};
}

async function editCollection(id){
  if(!staff()) return alert('Committee/admin login is required to edit a collection.');
  const {data,error}=await supabase.from('collections').select('*').eq('id',id).maybeSingle();
  if(error||!data) return alert('Unable to load collection for editing.');
  const legacy=parseLegacyNotes(data.notes);
  openModal('Edit Collection',[
    {label:'Block No',id:'editBlock',value:data.block_no||legacy.block,full:false},
    {label:'Flat No',id:'editFlat',value:data.flat_no||legacy.flat,full:false},
    {label:'Name',id:'editName',value:legacy.name,full:false},
    {label:'Amount',id:'editAmount',value:String(data.amount??''),type:'number',full:false},
    {label:'Date',id:'editDate',value:data.collection_date||'',type:'date',full:false},
    {label:'Payment Mode',id:'editMode',value:data.payment_mode||'UPI',type:'select',options:['UPI','Cash','Bank Transfer','Cheque'],full:false},
    {label:'Status',id:'editStatus',value:data.status||'Paid',type:'select',options:['Paid','Progress','Cancelled'],full:false},
    {label:'Receipt No',id:'editReceiptNo',value:data.receipt_no||'',full:false},
    {label:'Transaction ID',id:'editTransactionId',value:data.transaction_id||'',full:false},
    {label:'Collection Type',id:'editType',value:data.collection_type||'Flat wise 2026 collection',type:'select',options:['Flat wise 2026 collection','Donation','Sponsorship','Other'],full:true}
  ],async v=>{
    if(!v.editBlock.trim()||!v.editFlat.trim())return alert('Block No and Flat No are required.');
    const n=Number(v.editAmount); if(!Number.isFinite(n)||n<=0)return alert('Please enter a valid amount greater than 0.');
    if(!v.editDate)return alert('Date is required.');
    const result=await supabase.from('collections').update({block_no:v.editBlock.trim(),flat_no:v.editFlat.trim(),notes:v.editName.trim()||null,amount:n,collection_date:v.editDate,payment_mode:v.editMode,status:v.editStatus,receipt_no:v.editReceiptNo.trim()||null,transaction_id:v.editTransactionId.trim()||null,collection_type:v.editType,updated_at:new Date().toISOString()}).eq('id',id);
    if(result.error)return alert('Unable to update collection: '+result.error.message);
    closeModal(); alert('Collection updated successfully.'); window.location.reload();
  });
}

async function editExpense(id){
  if(!staff()) return alert('Committee/admin login is required to edit an expense.');
  const {data,error}=await supabase.from('expenses').select('*').eq('id',id).maybeSingle();
  if(error||!data) return alert('Unable to load expense for editing.');
  openModal('Edit Expense',[
    {label:'Date',id:'editExpenseDate',value:data.expense_date||'',type:'date'},
    {label:'Expense Name',id:'editExpenseName',value:data.expense_name||''},
    {label:'Total Amount',id:'editExpenseTotal',value:String(data.total_amount??''),type:'number'},
    {label:'Advance Amount',id:'editExpenseAdvance',value:String(data.advance_amount??0),type:'number'},
    {label:'Status',id:'editExpenseStatus',value:data.expense_status||'Pending',type:'select',options:['Pending','Clear'],full:false}
  ],async v=>{
    if(!v.editExpenseDate)return alert('Date is required.');
    if(!v.editExpenseName.trim())return alert('Expense name is required.');
    const total=Number(v.editExpenseTotal),advance=Number(v.editExpenseAdvance);
    if(!Number.isFinite(total)||total<=0)return alert('Please enter a valid total amount greater than 0.');
    if(!Number.isFinite(advance)||advance<0)return alert('Please enter a valid advance amount.');
    if(advance>total)return alert('Advance amount cannot be greater than total amount.');
    const result=await supabase.from('expenses').update({expense_date:v.editExpenseDate,expense_name:v.editExpenseName.trim(),total_amount:total,advance_amount:advance,expense_status:v.editExpenseStatus,updated_at:new Date().toISOString()}).eq('id',id);
    if(result.error)return alert('Unable to update expense: '+result.error.message);
    closeModal(); alert('Expense updated successfully.'); window.location.reload();
  });
}

function enhanceCollections(){
  if(!staff())return;
  document.querySelectorAll('#collectionBody tr').forEach(row=>{
    const button=row.querySelector('.edit-collection');
    if(!button||row.querySelector('.edit-record-btn'))return;
    const cell=row.lastElementChild;
    if(cell){
      const b=document.createElement('button');b.type='button';b.className='secondary edit-record-btn';b.textContent='Edit';b.onclick=()=>editCollection(button.dataset.id);cell.appendChild(b);
    }
    button.remove();
  });
}

function enhanceExpenses(){
  if(!staff())return;
  document.querySelectorAll('#expenseGroups tbody tr').forEach(row=>{
    if(row.querySelector('.edit-expense-btn'))return;
    const cells=row.children;if(cells.length<9)return;
    const status=cells[7].querySelector('.expense-status');const id=status?.dataset.id||'';if(!id)return;
    const cell=document.createElement('td');
    const b=document.createElement('button');b.type='button';b.className='secondary edit-expense-btn';b.textContent='Edit';b.onclick=()=>editExpense(id);cell.appendChild(b);row.appendChild(cell);
  });
  document.querySelectorAll('#expenseGroups table').forEach(table=>{const head=table.querySelector('thead tr');if(head&&!head.querySelector('.edit-head')){const th=document.createElement('th');th.className='edit-head';th.textContent='Action';head.appendChild(th);}});
}

function run(){enhanceCollections();enhanceExpenses();}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>setTimeout(run,300));
