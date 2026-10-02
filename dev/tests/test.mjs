import assert from "node:assert/strict";
import * as r from "../../module/rules.mjs";
// Ch3/Ch7 examples
assert.equal(r.checkDie(30), 60);                 // 30 Str -> d60
assert.equal(r.statMin(30), 10);
assert.equal(r.statBonus(30), 6);                 // 30 SP -> +6 floor
// Ch8
assert.equal(r.attackDie(30), 30);                // d30
assert.equal(r.dodgeDie(30), 15);                 // 2d15
assert.equal(r.maxEnergy(30), 150); assert.equal(r.energyRecover(150), 15);
assert.equal(r.maxHP(16,16,16,3), 432); assert.equal(r.painThreshold(432), 108);
// Strengthened/Weakened examples from the doc
assert.equal(r.applyStacks(10, 3), 25);
assert.equal(r.applyStacks(10, -3), 1);
// Crit: attack >= 2x dodge
assert.deepEqual([r.resolveAttack(20,10).crit, r.resolveAttack(19,10).crit, r.resolveAttack(9,10).hit], [true,false,false]);
assert.equal(r.resolveAttack(10,10).hit, true);   // ties hit
// Full stealth: crit at >= dodge die, double at >= 2x
assert.equal(r.resolveFullStealth(14,15).critStacks, 0);
assert.equal(r.resolveFullStealth(15,15).critStacks, 2);
assert.equal(r.resolveFullStealth(30,15).critStacks, 4);
// Dice pools
assert.equal(r.poolFormula(1,30,0), "1d30");
assert.equal(r.poolFormula(2,15,1), "3d15kh2");
assert.equal(r.poolFormula(2,15,-2), "4d15kl2");
// Movement: default char, 16 each, total 144, mobility 48, threshold 72 -> 50*48/72=33.3 -> 35
assert.equal(r.moveSpeed({dex:16,snap:16,grasp:16,total:144},3), 35);
assert.equal(r.moveSpeed({dex:30,snap:30,grasp:30,total:144},3), 50);
assert.equal(r.moveSpeed({dex:0,snap:0,grasp:0,total:144},3), 10);
assert.equal(r.moveSpeed({dex:30,snap:30,grasp:30,total:144},1), 10);
// Force: 5*Str 16=80 vs maxHP 432 -> 0 ft; falling ignores half HP
assert.equal(r.resolveForce(80,{maxHp:432}), 0);
assert.equal(r.resolveForce(432,{maxHp:432, falling:true}), 43);
assert.equal(r.resolveForce(500,{lift:600,maxHp:10}), 0);
// Tempo
assert.equal(r.tempoModifier(54,0,108), 1); assert.equal(r.tempoModifier(108,0,108), 2);
assert.equal(r.tempoModifier(0,120,108), -2); assert.equal(r.tempoModifier(10,0,108), 0);
assert.deepEqual(r.movementCost({tempo:-2}), {ap:1, multiplier:3});
assert.deepEqual(r.movementCost({prone:true, stealth:true, tempo:1}), {ap:4, multiplier:1});
// Derived default character
const d = r.deriveCharacter({stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3});
assert.equal(d.effective.str.value,16); assert.equal(d.hpMax,432); assert.equal(d.restHeal,15); assert.equal(d.move,35);
console.log("all rules tests passed", d.hpMax, d.pain, d.move);
