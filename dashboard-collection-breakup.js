import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const TOTAL_FLATS=136;
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));

function addStyles(){
  if(document.getElementById('collectionBreakupStyles'))return;
  const style=document.createElement('style');
  style.id='collectionBreakupStyles';
  style.textContent=`
    .collection-breakup{margin-top:12px;padding:16px 18px;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:var(--card,#fff);box-shadow:0 4px 14px rgba(0,0,0,.05)}
    .collection-breakup-title{font-weight:700;font-size:15px;margin-bottom:10px}
    .collection-breakup-total,.collection-breakup-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:8px 0}
    .collection-breakup-total{border-bottom:1px solid rgba(0,0,0,.08);font-weight:700}
    .collection-breakup-total strong{font-size:17px}
    .collection-breakup-row{font-size:14px}
    .collection-breakup-row small{display:block;opacity:.62;font-size:11px;margin-top:2px}
    .collection-breakup-row strong{white-space:nowrap}
  `;
  document.head.appendChild(style);
}

async function updateDashboardCollectionBreakup(){
  const {data,error}=await supabase.from('collections').select('amount,status,collection_type');
  if(error){console.error('Dashboard collection breakup load error:',error);return;}

  const active=(data||[]).filter(x=>x.status!=='Cancelled');
  const flatWise=active.filter(x=>x.collection_type==='Flat wise 2026 collection');
  const donation=active.filter(x=>x.collection_type==='Donation');
  const carryForward=active.filter(x=>String(x.collection_type||'').trim().toLowerCase()==='last year carry forward'||String(x.notes||'').toLowerCase().includes('last year carry forward'));
  const total=active.reduce((sum,x)=>sum+Number(x.amount||0),0);
  const flatTotal=flatWise.reduce((sum,x)=>sum+Number(x.amount||0),0);
  const donationTotal=donation.reduce((sum,x)=>sum+Number(x.amount||0),0);
  const carryTotal=carryForward.reduce((sum,x)=>sum+Number(x.amount||0),0);
  const count=flatWise.length;
  const pct=Math.min(100,Math.round(count/TOTAL_FLATS*100));

  const totalEl=document.getElementById('totalCollected');
  if(totalEl)totalEl.textContent=money(total);
  const countEl=document.getElementById('contributorCount');
  if(countEl)countEl.textContent=`${count} / ${TOTAL_FLATS}`;
  const percentEl=document.getElementById('contributorPercent');
  if(percentEl)percentEl.textContent=`${pct}%`;
  const progress=document.getElementById('contributorProgress');
  if(progress)progress.style.width=`${pct}%`;

  const totalCard=totalEl?.closest('.stat');
  if(!totalCard)return;
  let box=document.getElementById('collectionBreakup');
  if(!box){
    box=document.createElement('div');
    box.id='collectionBreakup';
    box.className='collection-breakup';
    totalCard.insertAdjacentElement('afterend',box);
  }
  box.innerHTML=`
    <div class="collection-breakup-title">Collection Breakup</div>
    <div class="collection-breakup-total"><span>Total Collection</span><strong>${money(total)}</strong></div>
    <div class="collection-breakup-row"><span>Flat-wise Collection <small>${count} collections</small></span><strong>${money(flatTotal)}</strong></div>
    <div class="collection-breakup-row"><span>Donation <small>${donation.length} donations</small></span><strong>${money(donationTotal)}</strong></div>
    <div class="collection-breakup-row"><span>Last Year Carry Forward <small>Receipt: NA</small></span><strong>${money(carryTotal)}</strong></div>
  `;
}

function init(){
  addStyles();
  updateDashboardCollectionBreakup();
  setInterval(updateDashboardCollectionBreakup,30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
