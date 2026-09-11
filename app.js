import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = 'https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
let festivals=[], members=[], collections=[], expenses=[], profile=null;
const $=id=>document.getElementById(id);

async function load(){
  const [f,m,c,e,s]=await Promise.all([
    supabase.from('festivals').select('*').order('sort_order'),
    supabase.from('members').select('*').order('block_no').order('flat_no'),
    supabase.from('collections').select('*, festivals(name), members(block_no,flat_no,name)').order('collection_date',{ascending:false}),
    supabase.from('expenses').select('*, festivals(name)').order('expense_date',{ascending:false}),
    supabase.from('festival_financial_summary').select('*').order('sort_order')
  ]);
  festivals=f.data||[]; members=m.data||[]; collections=c.data||[]; expenses=e.data||[];
  const summaries=s.data||[];
  renderSummary(summaries); renderCollections(); renderExpenses(); fillSelects();
}
function renderSummary(rows){
  $('summaryBody').innerHTML=rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${money(r.total_collection)}</td><td>${money(r.total_expense)}</td><td class="${Number(r.balance)>=0?'positive':'negative'}">${money(r.balance)}</td></tr>`).join('')||emptyRow(4,'No festival data');
  const tc=rows.reduce((a,r)=>a+Number(r.total_collection||0),0),te=rows.reduce((a,r)=>a+Number(r.total_expense||0),0); $('totalCollected').textContent=money(tc); $('totalExpenses').textContent=money(te); $('totalBalance').textContent=money(tc-te);
}
function renderCollections(){const q=($('searchInput').value||'').toLowerCase(); const rows=collections.filter(x=>`${x.festivals?.name||''} ${x.members?.block_no||''} ${x.members?.flat_no||''} ${x.members?.name||''}`.toLowerCase().includes(q)); $('collectionBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.festivals?.name||'')}</td><td>${esc(x.members?.block_no||'')}</td><td>${esc(x.members?.flat_no||'')}</td><td>${esc(x.members?.name||'')}</td><td>${x.collection_date||''}</td><td>${money(x.amount)}</td><td><span class="status ${x.status==='Cancelled'?'cancelled':'paid'}">${esc(x.status||'Paid')}</span></td></tr>`).join('')||emptyRow(7,'No collections yet');}
function renderExpenses(){ $('expenseBody').innerHTML=expenses.map(x=>`<tr><td>${esc(x.festivals?.name||'')}</td><td>${x.expense_date||''}</td><td>${esc(x.expense_name||'')}</td><td>${money(x.total_amount)}</td><td>${x.bill_url?`<a href="${esc(x.bill_url)}" target="_blank" rel="noopener">View bill</a>`:'—'}</td></tr>`).join('')||emptyRow(5,'No expenses yet'); }
function fillSelects(){const opts=festivals.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join(''); ['collectionFestival','expenseFestival'].forEach(id=>$(id).innerHTML=opts); $('collectionMember').innerHTML=members.map(x=>`<option value="${x.id}">${esc(x.block_no)} ${esc(x.flat_no)} — ${esc(x.name)}</option>`).join('');}
function emptyRow(n,text){return `<tr><td colspan="${n}" class="muted center">${text}</td></tr>`}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function refreshAuth(){const {data:{session}}=await supabase.auth.getSession(); $('loginBtn').classList.toggle('hidden',!!session); $('logoutBtn').classList.toggle('hidden',!session); $('userBadge').classList.toggle('hidden',!session); if(session){const {data}=await supabase.from('user_profiles').select('*').eq('id',session.user.id).single(); profile=data; $('userBadge').textContent=data?.full_name||session.user.email; $('roleBadge').textContent=data?.role||'resident'; const staff=['admin','treasurer','committee'].includes(data?.role); $('adminPanel').classList.toggle('hidden',!staff);}else{$('adminPanel').classList.add('hidden');}}
async function addMember(ev){ev.preventDefault(); const {data:{user}}=await supabase.auth.getUser(); const society=profile?.society_id; const {error}=await supabase.from('members').insert({society_id:society,block_no:$('memberBlock').value,flat_no:$('memberFlat').value,name:$('memberName').value}); $('adminMessage').textContent=error?error.message:'Member saved.'; if(!error){ev.target.reset(); await load();}}
async function addFestival(ev){ev.preventDefault(); const {error}=await supabase.from('festivals').insert({society_id:profile?.society_id,name:$('festivalName').value,sort_order:Number($('festivalOrder').value||10)}); $('adminMessage').textContent=error?error.message:'Festival saved.'; if(!error){ev.target.reset(); await load();}}
async function addCollection(ev){ev.preventDefault(); const {error}=await supabase.from('collections').insert({festival_id:$('collectionFestival').value,member_id:$('collectionMember').value,amount:Number($('collectionAmount').value),collection_date:$('collectionDate').value,status:$('collectionStatus').value}); $('adminMessage').textContent=error?error.message:'Collection saved.'; if(!error){ev.target.reset(); await load();}}
async function addExpense(ev){ev.preventDefault(); const {error}=await supabase.from('expenses').insert({festival_id:$('expenseFestival').value,expense_date:$('expenseDate').value,expense_name:$('expenseName').value,total_amount:Number($('expenseAmount').value),bill_url:$('expenseBill').value||null}); $('adminMessage').textContent=error?error.message:'Expense saved.'; if(!error){ev.target.reset(); await load();}}

$('loginBtn').onclick=()=>{$('authPanel').classList.remove('hidden')}; $('logoutBtn').onclick=async()=>{await supabase.auth.signOut(); await refreshAuth();}; $('refreshBtn').onclick=load; $('searchInput').oninput=renderCollections;
$('memberForm').onsubmit=addMember; $('festivalForm').onsubmit=addFestival; $('collectionForm').onsubmit=addCollection; $('expenseForm').onsubmit=addExpense;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');const signup=b.dataset.auth==='signup';$('nameWrap').classList.toggle('hidden',!signup);$('authSubmit').textContent=signup?'Create account':'Login';$('authForm').dataset.mode=signup?'signup':'login';});
$('authForm').onsubmit=async e=>{e.preventDefault();const signup=e.currentTarget.dataset.mode==='signup';const email=$('email').value,password=$('password').value;let result=signup?await supabase.auth.signUp({email,password,options:{data:{full_name:$('fullName').value}}}):await supabase.auth.signInWithPassword({email,password});$('authMessage').textContent=result.error?result.error.message:(signup?'Account created. Check your email if confirmation is enabled.':'Logged in.');if(!result.error){$('authPanel').classList.add('hidden');await refreshAuth();await load();}};
(async()=>{document.getElementById('authForm').dataset.mode='login'; await refreshAuth(); await load();})();