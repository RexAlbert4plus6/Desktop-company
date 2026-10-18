const canvas=document.getElementById('sprite'),context=canvas.getContext('2d');
let frames={},current='front',loaded=false;
function size(){canvas.style.width=`${164/devicePixelRatio}px`;canvas.style.height=`${154/devicePixelRatio}px`;}
function draw(id){current=id;if(!loaded)return;const frame=frames[id]||frames.front;context.clearRect(0,0,164,154);context.imageSmoothingEnabled=false;context.drawImage(frame.image,frame.offset[0]*2,frame.offset[1]*2,164,164);canvas.dataset.frame=id;}
window.kairos.onCatFrame(draw);
window.kairos.catArtwork().then(async data=>{
 await Promise.all(Object.entries(data.frames).map(([id,frame])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{frames[id]={...frame,image};resolve();};image.onerror=()=>reject(Error('猫猫图片加载失败'));image.src=frame.url;})));
 loaded=true;size();draw(current);
}).catch(()=>{document.getElementById('cat').title='素材无法加载，点击返回人物';});
window.addEventListener('resize',size);size();
document.getElementById('cat').onclick=()=>window.kairos.returnHuman();
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.kairos.returnHuman();});
document.getElementById('cat').oncontextmenu=event=>{event.preventDefault();window.kairos.returnHuman();};
