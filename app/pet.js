const petButton=document.getElementById('pet');
let pointer=null,moved=false,animator,currentExpression={id:'normal'},appliedExpression,artRevision=0,accessoryImages=[];
const gesture=new HeadpatGesture();let patEndTimer,lastPatPing=0;
function endPat(){clearTimeout(patEndTimer);const started=gesture.started,result=gesture.end();petButton.classList.remove('headpat-active');if(result)window.kairos.headpat('end',result.kind);else if(started)window.kairos.headpat('cancel');}
function applyExpression(value){currentExpression=value;const key=`${value.id}:${value.locked}:${value.expiresAt}:${value.temporary}`;if(animator&&key!==appliedExpression){appliedExpression=key;animator.show(value.id);}document.getElementById('portrait').dataset.expression=value.id;}
function fixedSize(state){petButton.style.width=`${state.config.size}px`;petButton.style.height=`${Math.round(state.config.size*1.2)}px`;document.getElementById('pet-name').textContent=state.config.characterName||'KAIROS';for(const item of accessoryImages){const layer=document.getElementById('layer-'+item.id);layer.src=item.image||'';layer.hidden=!item.image||!state.config.accessories?.[item.id];}}
async function loadArtwork(state){
 const revision=++artRevision;animator?.dispose();animator=null;appliedExpression=null;endPat();fixedSize(state);currentExpression=state.expression;accessoryImages=state.accessories||[];fixedSize(state);
 const images={...state.expressionImages,normal:state.expressionImages.normal||state.image};
 await Promise.all(Object.values(images).filter(Boolean).map(source=>new Promise(resolve=>{const image=new Image();image.onload=resolve;image.onerror=resolve;image.src=source;})));
 if(revision!==artRevision)return;
 animator=new PortraitAnimator({images,visible:()=>!document.hidden,draw:(source,frame)=>{const portrait=document.getElementById('portrait');portrait.src=source;portrait.dataset.frame=frame;}});applyExpression(currentExpression);
}
window.kairos.load().then(loadArtwork);window.kairos.onArtwork(loadArtwork);window.kairos.onState(fixedSize);window.kairos.onExpression(applyExpression);
document.addEventListener('visibilitychange',()=>{if(document.hidden){endPat();animator?.pause();}else animator?.resume();});
window.addEventListener('beforeunload',()=>{animator?.dispose();endPat();});
petButton.onpointerdown=event=>{if(event.button!==0)return;endPat();pointer={originX:event.screenX,originY:event.screenY};moved=false;petButton.setPointerCapture(event.pointerId);window.kairos.drag('start');};
petButton.onpointermove=event=>{
 if(pointer){if(Math.abs(event.screenX-pointer.originX)+Math.abs(event.screenY-pointer.originY)>5)moved=true;return;}
 if(event.buttons)return;
 const rect=document.querySelector('.portrait-stage').getBoundingClientRect(),side=Math.min(rect.width,rect.height);
 const x=(event.clientX-rect.left-(rect.width-side)/2)/side,y=(event.clientY-rect.top-(rect.height-side)/2)/side;
 const inside=x>=.18&&x<=.76&&y>=.17&&y<=.43;
 if(!inside){if(gesture.started){clearTimeout(patEndTimer);patEndTimer=setTimeout(endPat,350);}return;}
 const time=performance.now(),result=gesture.feed(x,y,time,true);
 if(result==='start'){window.kairos.headpat('start');petButton.classList.add('headpat-active');lastPatPing=time;}
 if(gesture.started){if(time-lastPatPing>300){window.kairos.headpat('continue');lastPatPing=time;}clearTimeout(patEndTimer);patEndTimer=setTimeout(endPat,600);}
};
petButton.onpointerleave=()=>{clearTimeout(patEndTimer);patEndTimer=setTimeout(endPat,350);};
petButton.onpointerup=event=>{if(event.button!==0||!pointer)return;pointer=null;window.kairos.drag('end');if(!moved)window.kairos.toggleChat();};
petButton.onpointercancel=()=>{pointer=null;window.kairos.drag('end');endPat();};
window.addEventListener('blur',()=>{pointer=null;window.kairos.drag('end');});
petButton.oncontextmenu=event=>{event.preventDefault();endPat();window.kairos.menu();};
petButton.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();window.kairos.toggleChat();}};
