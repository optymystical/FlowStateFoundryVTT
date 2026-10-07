import assert from "node:assert/strict";
import * as m from "../../module/martial.mjs";
// Dice: floor(capped/10), can be 0; capped at grade*10
assert.equal(m.weaponDice(16,3),1); assert.equal(m.weaponDice(30,3),3); assert.equal(m.weaponDice(45,3),3); assert.equal(m.weaponDice(5,3),0);
// Light Bladed Hardwood g3, 16 dex -> 1d8, 2 AP, dur 90 limit 18
let p = m.weaponProfile({type:"bladed",weight:"light",material:"hardwood",grade:3},{dex:16,str:16});
assert.equal(p.formula,"1d8"); assert.equal(p.ap,2); assert.equal(p.durability,90); assert.equal(p.limit,18);
// Heavy Bladed Iron g3, 30 str: 3d12 + Cleave (min 10), Broad x2 limit, 2H doubles
p = m.weaponProfile({type:"bladed",weight:"heavy",material:"iron",grade:3,twoHanded:true},{dex:16,str:30});
assert.equal(p.formula,"(3d12) * 2"); assert.equal(p.display,"(3d12) * 2 (+20 Cleave vs objects)"); assert.equal(p.ap,3); assert.equal(p.limit,12*3*2); assert.equal(p.solitary,2); assert.equal(p.cleave,20);
// Striker heavy Cleave+ = full stat; knockback weighted heavy 10x
assert.equal(m.weaponProfile({type:"striker",weight:"heavy",material:"iron",grade:2},{str:30}).formula,"2d12");
{ const kp = m.weaponProfile({type:"weighted",weight:"heavy",material:"iron",grade:2},{str:30}); assert.equal(kp.knockback,200); }
{ const kp = m.weaponProfile({type:"weighted",weight:"heavy",material:"iron",grade:2,twoHanded:true},{str:30}); assert.equal(kp.knockback,300); }
// Invalid material/weight combo
assert.equal(m.weaponProfile({type:"bladed",weight:"heavy",material:"hardwood",grade:1},{str:10}).valid,false);
// Unarmed: no material needed, can't two-hand
p = m.weaponProfile({type:"unarmed",weight:"light",grade:2,twoHanded:true},{dex:20}); assert.equal(p.valid,true); assert.equal(p.hands,1); assert.equal(p.formula,"2d10");
// Materials: Scarletite heat, Gray Iron throw cap good->average, Gray Steel always bad
assert.equal(m.weaponProfile({type:"swift",weight:"light",material:"scarletite",grade:1},{dex:10}).damageType,"heat");
assert.equal(m.weaponProfile({type:"swift",weight:"light",material:"grayIron",grade:1},{dex:10}).throwType,"average");
assert.equal(m.weaponProfile({type:"balanced",weight:"light",material:"graySteel",grade:1},{dex:10}).throwType,"bad");
// Ranged
p = m.weaponProfile({type:"longshot",weight:"heavy",material:"iron",grade:3},{str:30}); assert.equal(p.die,14); assert.equal(p.reloadRP,3); assert.equal(p.range,300); assert.equal(p.pierce,7);
// Armor: Con scaling capped, min x1
assert.equal(m.armorMultiplier(16,3),1); assert.equal(m.armorMultiplier(30,3),3); assert.equal(m.armorMultiplier(50,3),3); assert.equal(m.armorMultiplier(5,3),1);
let a = m.armorProfile({weight:"heavy",material:"steel",grade:3},25); assert.equal(a.durability,240); assert.equal(a.limit,48); assert.equal(a.moveAP,1); assert.equal(a.speedPct,60); assert.equal(a.stealthDis,1);
// Gray iron / gray steel penalties
// Armor takes a percentage of speed: Light 20, Medium 40, Heavy 60, Titanic 80; Gray Iron/Steel pushed past Titanic is 0% speed (and +1 AP two past it)
assert.deepEqual([m.armorPenalties("light","iron").speedPct,m.armorPenalties("medium","iron").speedPct,m.armorPenalties("heavy","iron").speedPct,m.armorPenalties("titanic","iron").speedPct],[20,40,60,80]);
assert.deepEqual(m.armorPenalties("titanic","grayIron"), {effectiveWeight:"titanic",stealthDis:Infinity,speedPct:100,moveAP:1});
assert.deepEqual(m.armorPenalties("medium","grayIron"), {effectiveWeight:"heavy",stealthDis:1,speedPct:60,moveAP:1});
assert.deepEqual(m.armorPenalties("heavy","graySteel"), {effectiveWeight:"titanic",stealthDis:Infinity,speedPct:100,moveAP:1});
assert.deepEqual(m.armorPenalties("titanic","graySteel"), {effectiveWeight:"titanic",stealthDis:Infinity,speedPct:100,moveAP:2});
assert.equal(m.armorPenalties("medium","graySteel").effectiveWeight,"titanic");
// Soak: limit 48 steel vs physical; vs heat 1/10 -> 4; vs arcane 0; pierce reduces
assert.deepEqual(m.soak(100,"physical",a), {absorbed:48,toHp:52,durabilityLoss:48});
assert.equal(m.soak(100,"heat",a).absorbed,4); assert.equal(m.soak(100,"arcane",a).absorbed,0);
assert.equal(m.soak(100,"physical",a,{pierce:10}).absorbed,38);
assert.equal(m.soak(20,"physical",a).toHp,0);
// Silver armor blocks supernatural fully, physical at 1/10
const s = m.armorProfile({weight:"light",material:"silver",grade:1},10);
assert.equal(m.soak(50,"supernatural",s).absorbed,8); assert.equal(m.soak(50,"physical",s).absorbed,0);
// Mithrite: armor durability loss weakened
const mi = m.armorProfile({weight:"light",material:"mithrite",grade:1},10); assert.deepEqual(m.soak(10,"physical",mi),{absorbed:3,toHp:7,durabilityLoss:1});
// Broken armor soaks nothing
assert.equal(m.soak(50,"physical",a,{durability:0}).absorbed,0);
console.log("martial tests passed");
assert.equal(m.weaponProfile({type:"unarmed",weight:"light",grade:1},{dex:45}).formula,"4d10");   // no Grade cap for Unarmed
assert.equal(m.weaponProfile({type:"unarmed",weight:"heavy"},{str:30}).formula,"3d12");
console.log("unarmed tests passed");
