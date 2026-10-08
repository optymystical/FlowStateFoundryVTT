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
// Movement: the Size's maximum, less percentages that add up, in 5 ft steps, never under 5 ft
assert.equal(r.moveSpeed(3), 50); assert.equal(r.moveSpeed(1), 10); assert.equal(r.moveSpeed(2), 25); assert.equal(r.moveSpeed(4), 100); assert.equal(r.moveSpeed(5), 200);
assert.equal(r.moveSpeed(3, 20), 40); assert.equal(r.moveSpeed(3, 20 + 20), 30); assert.equal(r.moveSpeed(3, 80), 10);
assert.equal(r.moveSpeed(3, 100), 5); assert.equal(r.moveSpeed(3, 250), 5); assert.equal(r.moveSpeed(2, 20), 20); assert.equal(r.moveSpeed(2, 60), 10);
assert.equal(r.speedFt(50, 0), 50); assert.equal(r.speedFt(35, 20), 30);
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
const dl = r.deriveCharacter({stats:{str:10,dex:10,con:10,pon:10,snap:10,will:10,reach:10,grasp:10,build:10}, skillPoints:30, size:3, hpLost:100});
assert.equal(dl.hpMax,332); assert.equal(dl.pain,108, "Max HP loss doesn't lower the Pain Threshold");
assert.equal(d.effective.str.value,16); assert.equal(d.hpMax,432); assert.equal(d.restHeal,15); assert.equal(d.move,50, "base speed is the Size maximum, whatever the stats");
console.log("all rules tests passed", d.hpMax, d.pain, d.move);
