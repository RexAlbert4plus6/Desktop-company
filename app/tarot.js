const $=id=>document.getElementById(id);let state,pending=false;
const errorText=e=>e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
function render(value){state=value;const chosen=value.selected!==null;const busy=value.status==='reading';$('cards').replaceChildren();
 for(let index=0;index<3;index++){const button=document.createElement('button');button.dataset.card=index;button.setAttribute('aria-label',`选择第 ${index+1} 张牌`);button.disabled=chosen||pending||busy;button.className=chosen?(index===value.selected?'selected':'unchosen'):'';const img=document.createElement('img');img.src=value.back;img.alt='塔罗牌背';button.append(img);button.onclick=()=>read(index);$('cards').append(button);}
 $('question-label').hidden=chosen;$('name').textContent=value.card?.name||'';$('orientation').textContent=value.card?`${value.card.reversed?'逆位 · Reversed':'正位 · Upright'} · 牌面绘制中，暂用牌背`:'';
 $('answer').textContent=busy?'Samuel 正在为你解读…':value.answer||'';$('notice').textContent=value.error||'';$('retry').hidden=value.status!=='error';$('again').hidden=!['done','error'].includes(value.status);$('again').disabled=pending||busy;
}
async function read(index,retry=false){if(pending)return;pending=true;render(state);try{render(await window.kairos.tarotRead({id:state.id,index,question:$('question').value,retry}));}catch(e){$('notice').textContent=errorText(e);}finally{pending=false;const notice=$('notice').textContent;render(state);if(notice)$('notice').textContent=notice;}}
$('retry').onclick=()=>read(state.selected,true);$('again').onclick=async()=>{try{const value=await window.kairos.tarotNew();$('question').value='';render(value);}catch(e){$('notice').textContent=errorText(e);}};
$('close').onclick=()=>window.kairos.tarotClose();document.onkeydown=e=>{if(e.key==='Escape')window.kairos.tarotClose();};window.kairos.onTarotState(render);window.kairos.tarotState().then(render).catch(e=>$('notice').textContent=errorText(e));
