function syncCollectionMember(form, blockId, flatId, memberId){
  const block=(document.getElementById(blockId)?.value||'').trim().toLowerCase();
  const flat=(document.getElementById(flatId)?.value||'').trim().toLowerCase();
  const select=document.getElementById(memberId);
  if(!select)return;
  const prefix=`${block} ${flat} —`.toLowerCase();
  const match=[...select.options].find(o=>o.value && o.textContent.trim().toLowerCase().startsWith(prefix));
  select.value=match?match.value:'';
}

document.addEventListener('submit',event=>{
  const form=event.target;
  if(form?.id==='quickCollectionForm') syncCollectionMember(form,'quickCollectionBlock','quickCollectionFlat','quickCollectionMember');
  if(form?.id==='collectionForm') syncCollectionMember(form,'collectionBlock','collectionFlat','collectionMember');
},true);
