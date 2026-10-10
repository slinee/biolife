import {advance,createCulture} from './engine.js';

export const WIDTH=150,HEIGHT=100,FORMAT='bioform-habitat',VERSION=1;
export const DEFAULT_CONFIG={nutrientRegen:.05,uptake:.035,metabolism:.025,reproductionRate:.12,reproductionCost:.35,predationRate:.035,maxAge:240,mutation:.02};
export const CONFIG_LIMITS={nutrientRegen:[0,.2],uptake:[0,.3],metabolism:[0,.2],reproductionRate:[0,1],reproductionCost:[.05,1],predationRate:[0,.2],maxAge:[10,5000],mutation:[0,1]};
export const PRESETS=['reef','tidepool','bloom','gliders','empty'];
export const MODES=['ecosystem','conway','reef','seeds'];
export function validateConfig(input={}){
 const out={...DEFAULT_CONFIG};
 for(const [key,[min,max]] of Object.entries(CONFIG_LIMITS)){
  if(input[key]===undefined)continue;const value=input[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(key==='maxAge'&&!Number.isInteger(value)))throw new Error(`Invalid ${key}: expected ${min}–${max}.`);
  out[key]=value;
 }
 return out;
}
export function createExperiment({preset='reef',seed=917,mode,config={}}={}){
 if(!PRESETS.includes(preset))throw new Error('Unknown initial culture.');
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Seed must be an integer from 0 to 4294967295.');
 const sample=preset==='empty'?{cells:new Uint8Array(WIDTH*HEIGHT),habitat:new Uint8Array(WIDTH*HEIGHT),mode:'ecosystem'}:createCulture(preset,WIDTH,HEIGHT,seed);
 mode=mode||sample.mode;if(!MODES.includes(mode))throw new Error('Unknown evolution model.');
 if(mode==='conway')sample.cells=sample.cells.map(s=>s?1:0);
 const n=WIDTH*HEIGHT;
 return {width:WIDTH,height:HEIGHT,preset,seed,mode,config:validateConfig(config),generation:0,rngState:seed>>>0,cells:sample.cells,habitat:sample.habitat,nutrients:Float32Array.from(sample.habitat,v=>v?.8:0),energy:Float32Array.from(sample.cells,v=>v?.8:0),ages:new Uint16Array(n),births:0,deaths:0};
}
export function randomFor(state){return ()=>{state.rngState=(state.rngState+0x6D2B79F5)>>>0;let t=state.rngState;t=Math.imul(t^t>>>15,1|t);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function neighbors(i,width,height){const x=i%width,y=Math.floor(i/width),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)out.push(((y+dy+height)%height)*width+(x+dx+width)%width);return out;}
// Cached topology makes interactive and batch runs use the identical wrapping grid.
const topology=Array.from({length:WIDTH*HEIGHT},(_,i)=>neighbors(i,WIDTH,HEIGHT));
export function stepExperiment(state){
 const random=randomFor(state),old=state.cells,n=old.length;
 if(state.mode!=='ecosystem'){
  const result=advance(old,state.width,state.height,state.mode,state.config.mutation,random);
  for(let i=0;i<n;i++){state.ages[i]=result.cells[i]?(old[i]===result.cells[i]?Math.min(state.ages[i]+1,65535):0):0;state.energy[i]=result.cells[i]?1:0;}
  state.cells=result.cells;state.births=result.births;state.deaths=result.deaths;state.generation++;return state;
 }
 const config=state.config,next=old.slice(),energy=state.energy.slice(),ages=state.ages.slice(),nutrients=state.nutrients.slice();let births=0,deaths=0;
 // Uptake transfers local nutrients into stored energy. Maintenance and age can
 // kill a cell; part of its stored energy returns to local nutrients.
 for(let i=0;i<n;i++){
  if(!state.habitat[i]){next[i]=0;energy[i]=0;ages[i]=0;nutrients[i]=0;continue;}
  nutrients[i]=Math.min(1,nutrients[i]+config.nutrientRegen*(1-nutrients[i]));
  if(!old[i])continue;
  const uptake=Math.min(nutrients[i],config.uptake,Math.max(0,2-energy[i]));
  nutrients[i]-=uptake;energy[i]=Math.max(0,Math.min(2,energy[i]+uptake-config.metabolism));ages[i]++;
  if(energy[i]<=0||ages[i]>=config.maxAge){next[i]=0;nutrients[i]=Math.min(1,nutrients[i]+energy[i]*.35);energy[i]=0;ages[i]=0;deaths++;}
 }
 // Predation uses the input grid, so no newly replaced lineage can cascade in
 // the same generation. The three competitors form the same cyclic relation.
 for(let i=0;i<n;i++)if(old[i]&&next[i]){
  const predator=old[i]===1?3:old[i]-1;let predators=0;
  for(const j of topology[i])if(old[j]===predator)predators++;
  if(predators&&random()<predators*config.predationRate){next[i]=predator;energy[i]=energy[i]*.8;ages[i]=0;births++;deaths++;}
 }
 // Only previously empty sites can be born. A parent pays for every offspring,
 // and each transfer is deducted immediately to prevent spending energy twice.
 for(let i=0;i<n;i++)if(!old[i]&&state.habitat[i]&&random()<config.reproductionRate){
  const eligible=topology[i].filter(j=>old[j]&&next[j]===old[j]&&energy[j]>=config.reproductionCost+.15);
  if(!eligible.length)continue;
  const parent=eligible[Math.floor(random()*eligible.length)];energy[parent]-=config.reproductionCost;
  next[i]=random()<config.mutation?1+Math.floor(random()*3):next[parent];energy[i]=config.reproductionCost*.8;ages[i]=0;births++;
 }
 state.cells=next;state.energy=energy;state.ages=ages;state.nutrients=nutrients;state.births=births;state.deaths=deaths;state.generation++;return state;
}
export function measure(state){
 const counts=[0,0,0];let population=0,nutrient=0,energy=0,age=0,area=0;
 for(let i=0;i<state.cells.length;i++){const s=state.cells[i];if(state.habitat[i]){area++;nutrient+=state.nutrients[i];}if(s){population++;counts[s-1]++;energy+=state.energy[i];age+=state.ages[i];}}
 const proportions=counts.map(v=>population?v/population:0),diversity=-proportions.reduce((sum,p)=>sum+(p?p*Math.log(p):0),0);
 return {generation:state.generation,population,births:state.births,deaths:state.deaths,algae:counts[0],coral:counts[1],spores:counts[2],density:population/state.cells.length,diversity,mean_nutrient:state.mode==='ecosystem'?(area?nutrient/area:0):null,mean_energy:state.mode==='ecosystem'?(population?energy/population:0):null,mean_age:population?age/population:0,habitat_cells:area};
}
export function serializeHabitat(state,name='Untitled habitat'){
 const out={format:FORMAT,version:VERSION,name:String(name).trim().slice(0,80)||'Untitled habitat',savedAt:new Date().toISOString(),width:state.width,height:state.height,preset:state.preset,seed:state.seed,mode:state.mode,config:{...state.config},generation:state.generation,rngState:state.rngState,births:state.births,deaths:state.deaths};
 for(const key of ['cells','habitat','nutrients','energy','ages'])out[key]=Array.from(state[key]);return out;
}
export function deserializeHabitat(input){
 if(!input||typeof input!=='object'||input.format!==FORMAT||input.version!==VERSION)throw new Error('This is not a supported BIOFORM habitat file.');
 if(input.width!==WIDTH||input.height!==HEIGHT)throw new Error('Habitat dimensions must be 150 × 100.');
 if(!Number.isInteger(input.seed)||input.seed<0||input.seed>4294967295)throw new Error('Missing or invalid seed.');
 if(!PRESETS.includes(input.preset)||!MODES.includes(input.mode))throw new Error('Missing or invalid initial culture or evolution model.');
 if(!input.config||typeof input.config!=='object'||Array.isArray(input.config)||Object.keys(DEFAULT_CONFIG).some(key=>input.config[key]===undefined))throw new Error('Missing or incomplete experiment configuration.');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)throw new Error('Habitat name must contain 1–80 characters.');
 const state=createExperiment({preset:input.preset,seed:input.seed,mode:input.mode,config:input.config});
 for(const key of ['generation','rngState','births','deaths'])if(!Number.isInteger(input[key])||input[key]<0||input[key]>(key==='rngState'?4294967295:['births','deaths'].includes(key)?WIDTH*HEIGHT:1e12))throw new Error(`Invalid ${key}.`);
 const specs={cells:[Uint8Array,0,3,true],habitat:[Uint8Array,0,1,true],nutrients:[Float32Array,0,1,false],energy:[Float32Array,0,2,false],ages:[Uint16Array,0,65535,true]};
 for(const [key,[Type,min,max,integer]] of Object.entries(specs)){
  const values=input[key];if(!Array.isArray(values)||values.length!==WIDTH*HEIGHT)throw new Error(`Invalid ${key} array length.`);
  if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v))))throw new Error(`Invalid ${key} values.`);
  state[key]=Type.from(values);
 }
 for(let i=0;i<state.cells.length;i++){
  if(state.mode==='ecosystem'&&state.cells[i]&&!state.habitat[i])throw new Error('Living ecology cells must be inside the habitat.');
  if(state.mode==='conway'&&state.cells[i]>1)throw new Error('Conway habitats support one lineage.');
 }
 for(const key of ['generation','rngState','births','deaths'])state[key]=input[key];
 return {state,name:input.name.trim()};
}
export function validateBatch(options){
 const runs=Number(options.runs),steps=Number(options.steps),sampleEvery=Number(options.sampleEvery);
 if(!Number.isInteger(runs)||runs<1||runs>30)throw new Error('Use 1–30 independent runs.');
 if(!Number.isInteger(steps)||steps<1||steps>100000)throw new Error('Use 1–100,000 generations per run.');
 if(!Number.isInteger(sampleEvery)||sampleEvery<1||sampleEvery>steps)throw new Error('Sampling interval must be 1–generations per run.');
 if((Math.ceil(steps/sampleEvery)+1)*runs>100000)throw new Error('Reduce runs or increase the sampling interval (100,000 samples maximum).');
 const seed=Number(options.seed);if(!Number.isInteger(seed)||seed<0||seed+runs-1>4294967295)throw new Error('Batch seeds must fit the 32-bit range.');
 const config=validateConfig(options.config);createExperiment({preset:options.preset,mode:options.mode,seed,config});
 return {runs,steps,sampleEvery,seed,preset:options.preset,mode:options.mode,config};
}
export function summarizeRun(seed,samples,state){
 const final=measure(state);let total=0,min=Infinity,max=-Infinity;for(const sample of samples){total+=sample.population;min=Math.min(min,sample.population);max=Math.max(max,sample.population);}
 return {seed,generations:state.generation,samples:samples.length,final_population:final.population,mean_sampled_population:samples.length?total/samples.length:0,min_sampled_population:samples.length?min:0,max_sampled_population:samples.length?max:0,final_diversity:final.diversity,final_mean_nutrient:final.mean_nutrient,final_mean_energy:final.mean_energy};
}
export function rowsToCSV(rows){
 if(!rows.length)return '';const keys=Object.keys(rows[0]);const escape=value=>{const text=value===null||value===undefined?'':String(value);return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
 return [keys.join(','),...rows.map(row=>keys.map(key=>escape(row[key])).join(','))].join('\r\n')+'\r\n';
}
