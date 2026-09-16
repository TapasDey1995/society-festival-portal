// Loads app.js after replacing fragile nested Supabase relation selects with base-table selects.
// The existing app.js still owns all rendering, auth and admin logic.
(async()=>{
  try{
    const source=await (await fetch('./app.js',{cache:'no-store'})).text();
    const fixed=source
      .replace("supabase.from('collections').select('*, festivals(name), members(block_no,flat_no,name)')","supabase.from('collections').select('*')")
      .replace("supabase.from('expenses').select('*, festivals(name)')","supabase.from('expenses').select('*')")
      .replace("supabase.from('puja_schedules').select('*, festivals(name)')","supabase.from('puja_schedules').select('*')")
      .replace("festivals=f.data||[];members=m.data||[];collections=c.data||[];expenses=e.data||[];schedules=s.data||[];renderAll();fillSelects();",
        "festivals=f.data||[];members=m.data||[];collections=c.data||[];expenses=e.data||[];schedules=s.data||[];const festivalMap=new Map(festivals.map(x=>[x.id,x])),memberMap=new Map(members.map(x=>[x.id,x]));collections=collections.map(x=>({...x,festivals:festivalMap.get(x.festival_id)||null,members:memberMap.get(x.member_id)||null}));expenses=expenses.map(x=>({...x,festivals:festivalMap.get(x.festival_id)||null}));schedules=schedules.map(x=>({...x,festivals:festivalMap.get(x.festival_id)||null}));renderAll();fillSelects();");
    const blob=new Blob([fixed],{type:'text/javascript'});
    await import(URL.createObjectURL(blob));
    // Load the Puja Schedule quick-add/list module. It was present in the
    // repository but was not being loaded, so the Add Schedule button had no
    // click/submit handlers and the scheduleCards list stayed empty.
    await import('./schedule-cards.js?v=20260916');
    await import('./dashboard-collection-breakup.js?v=20260914');
  }catch(error){
    console.error('Portal loader error',error);
    const message=document.getElementById('adminMessage');
    if(message)message.textContent='Portal loading error. Please refresh the page.';
  }
})();
