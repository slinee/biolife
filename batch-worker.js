import {createExperiment,stepExperiment,measure,validateBatch,summarizeRun} from './research.js';
let active=null;
self.onmessage=event=>{
 if(event.data.type==='cancel'){if(active)active.cancelled=true;return;}
 if(event.data.type!=='start'||active)return;
 try{const options=validateBatch(event.data.options);active={cancelled:false};run(options,active);}catch(error){self.postMessage({type:'error',message:error.message});}
};
async function run(options,job){
 const results=[];let lastProgress=0;
 try{
 for(let run=0;run<options.runs&&!job.cancelled;run++){
  const seed=options.seed+run,state=createExperiment({...options,seed}),samples=[{seed,...measure(state)}];
  while(state.generation<options.steps&&!job.cancelled){
   for(let chunk=0;chunk<12&&state.generation<options.steps;chunk++){
    stepExperiment(state);if(state.generation%options.sampleEvery===0||state.generation===options.steps)samples.push({seed,...measure(state)});
   }
   if(performance.now()-lastProgress>120){self.postMessage({type:'progress',completed:run*options.steps+state.generation,total:options.runs*options.steps,run:run+1,generation:state.generation});lastProgress=performance.now();}
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(samples.at(-1).generation!==state.generation)samples.push({seed,...measure(state)});
  const result={status:job.cancelled?'cancelled':'complete',summary:summarizeRun(seed,samples,state),samples};results.push(result);
  self.postMessage({type:'run',result,index:run});
 }
 self.postMessage({type:'complete',cancelled:job.cancelled,options,results});
 }catch(error){self.postMessage({type:'error',message:error.message});}
 finally{active=null;}
}
