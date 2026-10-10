export const RULES={conway:{birth:[3],survive:[2,3]},reef:{birth:[3,6],survive:[2,3]},seeds:{birth:[2],survive:[]}};
export function advance(cells,width,height,mode='conway',mutation=0,random=Math.random){
 const next=new Uint8Array(cells.length);let births=0,deaths=0,population=0;const species=[0,0,0];const rule=RULES[mode];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;let n=0;const counts=[0,0,0,0];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const s=cells[((y+dy+height)%height)*width+(x+dx+width)%width];if(s){n++;counts[s]++;}}
  if(cells[i]&&rule.survive.includes(n))next[i]=cells[i];
  else if(!cells[i]&&rule.birth.includes(n)){let dominant=1;for(let s=2;s<=3;s++)if(counts[s]>counts[dominant])dominant=s;next[i]=mode==='conway'?1:random()<mutation?1+Math.floor(random()*3):dominant;births++;}
  if(cells[i]&&!next[i])deaths++;if(next[i]){population++;species[next[i]-1]++;}
 }
 return {cells:next,births,deaths,population,species};
}

// A stochastic, synchronous cyclic-competition automaton. Each lineage has one
// predator and one prey; births and deaths include replacement transitions.
export function advanceEcosystem(cells,width,height,habitat,mutation=0,random=Math.random){
 const next=new Uint8Array(cells.length),species=[0,0,0];let births=0,deaths=0,population=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,old=cells[i];if(!habitat[i])continue;
  const counts=[0,0,0,0];let neighbors=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const s=cells[((y+dy+height)%height)*width+(x+dx+width)%width];if(s){counts[s]++;neighbors++;}}
  let value=old;
  if(old){const predator=old===1?3:old-1;if(random()<counts[predator]*.085)value=predator;else if(random()<.012)value=0;}
  else if(neighbors&&random()<.18+neighbors*.055){let pick=Math.floor(random()*neighbors);for(let s=1;s<=3;s++){pick-=counts[s];if(pick<0){value=s;break;}}if(random()<mutation)value=1+Math.floor(random()*3);}
  next[i]=value;if(value!==old){if(value)births++;if(old)deaths++;}if(value){population++;species[value-1]++;}
 }
 return {cells:next,births,deaths,population,species};
}

export function seededRandom(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function createCulture(name,width=150,height=100,seed=917){
 const cells=new Uint8Array(width*height),habitat=new Uint8Array(cells.length),random=seededRandom(seed);
 if(name==='gliders'){
  habitat.fill(1);const pattern=[[1,0],[2,1],[0,2],[1,2],[2,2]];
  for(let y=10;y<height-10;y+=13)for(let x=10;x<width-10;x+=15){const ox=Math.floor(random()*4),oy=Math.floor(random()*4),turn=Math.floor(random()*4);for(const [px,py]of pattern){let dx=px,dy=py;for(let r=0;r<turn;r++){const t=dx;dx=2-dy;dy=t;}cells[(y+dy+oy)*width+x+dx+ox]=1;}}
  return {cells,habitat,mode:'conway'};
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const xx=x/width*150,yy=y/height*100;let inside=false,lineage=1;
  if(name==='reef'){
   const centers=[[24,33,18,1],[48,66,22,2],[86,40,27,3],[125,68,18,1],[126,19,11,2],[18,82,9,3]];
   for(const [cx,cy,r,s]of centers){const dx=xx-cx,dy=yy-cy,angle=Math.atan2(dy,dx),distance=Math.hypot(dx,dy);if(distance<r*(.90+.10*Math.cos(angle*5))){inside=true;lineage=1+((s-1+Math.floor((distance+Math.sin(angle*3)*3)/7))%3);}}
   if(xx>21&&xx<128&&Math.abs(yy-(64+14*Math.sin(xx*.065)))<3){inside=true;lineage=2;}
  }else if(name==='tidepool'){
   for(const [cx,cy,r,s]of [[39,40,29,1],[105,53,33,2],[55,86,9,3],[126,10,6,1]]){const dx=xx-cx,dy=(yy-cy)*1.12,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);if(d<r&&d>r*.28){inside=true;lineage=1+((s+Math.floor(d/6+a*1.4)+12)%3);}}
  }else{
   const dx=(xx-75)*.8,dy=yy-50,angle=Math.atan2(dy,dx),distance=Math.hypot(dx,dy),r=31+12*Math.cos(angle*7);
   inside=distance<r||Math.hypot(xx-19,yy-18)<8||Math.hypot(xx-132,yy-84)<7;
   lineage=1+((Math.floor((angle+Math.PI)*3/Math.PI+distance/8))%3);
  }
  if(inside){const i=y*width+x;habitat[i]=1;if(random()<.87)cells[i]=lineage;}
 }
 return {cells,habitat,mode:'ecosystem'};
}
