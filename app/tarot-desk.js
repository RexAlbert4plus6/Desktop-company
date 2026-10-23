(()=>{
 const byId=id=>document.getElementById(id);let value=null,pending=false,builtId=null;
 const errorText=e=>e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
 function render(next){value=next;const panel=byId('tarot-desk');panel.hidden=!next.open;if(!next.open)return;
  panel.style.setProperty('--card-width',`${next.size/3}px`);
  if(builtId!==next.id){builtId=next.id;byId('tarot-cards').replaceChildren();for(let index=0;index<3;index++){const button=document.createElement('button');button.type='button';button.dataset.card=index;button.setAttribute('aria-label',`选择第 ${index+1} 张牌`);const image=document.createElement('img');image.src=next.back;image.alt='塔罗牌背';button.append(image);button.onclick=()=>read(index);byId('tarot-cards').append(button);}}
  const chosen=next.selected!==null,spinning=next.status==='spinning';
  for(const button of byId('tarot-cards').children){const selected=Number(button.dataset.card)===next.selected;button.disabled=chosen||pending;button.classList.toggle('selected',selected);button.classList.toggle('unchosen',chosen&&!selected);button.classList.toggle('spinning',selected&&spinning);}
  byId('tarot-name').textContent=next.card&&!spinning?`${next.card.name} · ${next.card.reversed?'逆位':'正位'}`:'选一张牌，让 Samuel 为你解读';
  byId('tarot-retry').hidden=next.status!=='error';byId('tarot-again').hidden=!['done','error'].includes(next.status);byId('tarot-again').disabled=pending;
  if(next.status==='reading')byId('notice').textContent=`${next.name} 正在为你解读…`;
  else if(next.error)byId('notice').textContent=next.error;
  else if(next.status==='done')byId('notice').textContent='';
 }
 async function read(index,retry=false){if(pending)return;pending=true;render(value);try{render(await window.kairos.tarotRead({id:value.id,index,retry}));}catch(e){byId('notice').textContent=errorText(e);}finally{pending=false;if(value)render(value);}}
 byId('tarot-retry').onclick=()=>read(value.selected,true);
 byId('tarot-again').onclick=async()=>{try{render(await window.kairos.tarotNew());}catch(e){byId('notice').textContent=errorText(e);}};
 byId('tarot-close').onclick=()=>window.kairos.tarotClose();
 window.kairos.onTarotState(render);window.kairos.tarotState().then(render).catch(e=>byId('notice').textContent=errorText(e));
})();
