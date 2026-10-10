import {test} from 'node:test';import assert from 'node:assert/strict';import {advance} from './engine.js';
const grid=(points,w=8)=>{const a=new Uint8Array(w*w);points.forEach(([x,y])=>a[y*w+x]=1);return a;};
test('Conway block is stable',()=>{const a=grid([[3,3],[3,4],[4,3],[4,4]]);const b=advance(a,8,8);assert.deepEqual(b.cells,a);assert.equal(b.births,0);assert.equal(b.population,4);});
test('Conway blinker has period two and synchronous births/deaths',()=>{const a=grid([[2,3],[3,3],[4,3]]);const b=advance(a,8,8);assert.deepEqual(b.cells,grid([[3,2],[3,3],[3,4]]));assert.equal(b.births,2);assert.equal(b.deaths,2);assert.deepEqual(advance(b.cells,8,8).cells,a);});
test('Conway glider translates diagonally after four generations',()=>{let a=grid([[2,1],[3,2],[1,3],[2,3],[3,3]]);for(let i=0;i<4;i++)a=advance(a,8,8).cells;assert.deepEqual(a,grid([[3,2],[4,3],[2,4],[3,4],[4,4]]));});
test('Edges wrap and newborn species inherit their local majority',()=>{const a=grid([[7,3],[0,3],[1,3]]);assert.deepEqual(advance(a,8,8).cells,grid([[0,2],[0,3],[0,4]]));a[3*8+7]=2;a[3*8]=2;const b=advance(a,8,8,'reef');assert.equal(b.cells[2*8],2);});
test('HighLife supports six-neighbor births while Conway does not',()=>{const a=grid([[2,2],[3,2],[4,2],[2,3],[4,3],[3,4]]);assert.equal(advance(a,8,8,'reef').cells[3*8+3],1);assert.equal(advance(a,8,8,'conway').cells[3*8+3],0);});
test('Seeds has no survivors and color mutation never changes occupancy',()=>{const a=grid([[2,3],[3,3],[4,3]]);const seeds=advance(a,8,8,'seeds');assert.equal(seeds.cells[3*8+3],0);const normal=advance(a,8,8,'reef',0),mutated=advance(a,8,8,'reef',1,()=>.9);assert.deepEqual([...normal.cells].map(Boolean),[...mutated.cells].map(Boolean));assert.equal(mutated.cells[2*8+3],3);});

import {advanceEcosystem,createCulture,seededRandom} from './engine.js';
test('Ecology replacement follows the cyclic predator relation and counts both transitions',()=>{
 for(const [prey,predator]of [[1,3],[2,1],[3,2]]){const a=new Uint8Array(25),habitat=new Uint8Array(25);a[12]=prey;a[13]=predator;habitat.fill(1);const b=advanceEcosystem(a,5,5,habitat,0,()=>0);assert.equal(b.cells[12],predator);assert.equal(b.population,2+b.births-b.deaths);}
});
test('Ecology cannot colonize outside the habitat',()=>{
 const a=new Uint8Array(25),habitat=new Uint8Array(25);a[12]=1;habitat[12]=1;const b=advanceEcosystem(a,5,5,habitat,0,()=>.5);assert.equal(b.population,1);assert.equal(b.cells[12],1);
});
test('Every pixel culture is reproducible, bounded and supports all three lineages',()=>{
 for(const name of ['reef','tidepool','bloom']){const a=createCulture(name),b=createCulture(name);assert.deepEqual(a.cells,b.cells);assert.equal(a.cells.length,15000);assert.equal(a.mode,'ecosystem');for(let i=0;i<a.cells.length;i++)if(a.cells[i])assert.equal(a.habitat[i],1);assert.deepEqual([...new Set(a.cells)].sort(),[0,1,2,3]);assert.notDeepEqual(createCulture(name,150,100,123).cells,a.cells);}
 assert.notDeepEqual(createCulture('gliders',150,100,123).cells,createCulture('gliders').cells);
});
test('All three ecological cultures sustain diverse populations after 500 generations',()=>{
 for(const name of ['reef','tidepool','bloom']){const a=createCulture(name),random=seededRandom(59);let cells=a.cells,previous=cells.reduce((n,s)=>n+!!s,0),result;
 for(let n=0;n<500;n++){result=advanceEcosystem(cells,150,100,a.habitat,.02,random);assert.equal(result.population,previous+result.births-result.deaths);assert.equal(result.population,result.species.reduce((a,b)=>a+b));cells=result.cells;previous=result.population;}
 assert.ok(result.species.every(n=>n>500));}
});
