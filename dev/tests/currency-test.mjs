// Currencies: the list is made safe, and amounts merge down the chain.
let fails = 0; const ok = (c, m) => { console.log(`  ${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const C = await import("../../module/currency-rules.mjs");

console.log("== The currency list");
let d = C.sanitizeCurrencies(undefined);
ok(d.length === 1 && d[0].id === "c0" && d[0].name && d[0].img, "A world with nothing set up has one currency");
d = C.sanitizeCurrencies([{ name: "Copper" }], 3);
ok(d.length === 3 && d.map(c => c.id).join() === "c0,c1,c2" && d[0].name === "Copper" && d[1].name === "Currency 2", "A larger count adds numbered currencies; ids are positional");
d = C.sanitizeCurrencies(d, 99);
ok(d.length === C.MAX_CURRENCIES, `The count is capped at ${C.MAX_CURRENCIES}`);
d = C.sanitizeCurrencies([{ name: "Copper", mergeInto: "c1", mergeAmount: 100 }, { name: "Silver", mergeInto: "c2", mergeAmount: 10 }, { name: "Gold" }]);
ok(d[0].mergeInto === "c1" && d[1].mergeInto === "c2" && d[2].mergeInto === "", "A chain copper → silver → gold is kept");
d = C.sanitizeCurrencies([{ name: "A", mergeInto: "c1", mergeAmount: 5 }, { name: "B", mergeInto: "c0", mergeAmount: 5 }]);
ok(!(d[0].mergeInto && d[1].mergeInto), "A loop is cut");
d = C.sanitizeCurrencies([{ name: "A", mergeInto: "c0", mergeAmount: 5 }, { name: "B", mergeInto: "c9", mergeAmount: 5 }, { name: "C", mergeInto: "c0", mergeAmount: 1 }]);
ok(d.every(c => !c.mergeInto), "Merging into itself, into something that doesn't exist, or 1-for-1 is dropped");

console.log("== Merging");
const defs = C.sanitizeCurrencies([{ name: "Copper", mergeInto: "c1", mergeAmount: 100 }, { name: "Silver", mergeInto: "c2", mergeAmount: 10 }, { name: "Gold" }]);
let n = C.normalizeCurrency(defs, { c0: 250, c1: 3, c2: 0 });
ok(n.c0 === 50 && n.c1 === 5 && n.c2 === 0, "250 copper + 3 silver: 2 batches of 100 become 2 silver (50 copper, 5 silver)");
n = C.normalizeCurrency(defs, { c0: 1500, c1: 0, c2: 1 });
ok(n.c0 === 0 && n.c1 === 5 && n.c2 === 2, "It chains: 1500 copper → 15 silver → 1 gold + 5 silver (with the 1 gold already held: 2)");
n = C.normalizeCurrency(defs, { c0: -5, c1: "x", c2: 2.9 });
ok(n.c0 === 0 && n.c1 === 0 && n.c2 === 2, "Negative, junk and fractional amounts are cleaned to whole numbers");
const rows = C.currencyRows(defs, { c0: 5 });
ok(rows[0].amount === 5 && rows[0].note === "100 = 1 Silver" && rows[2].note === "", "A sheet row says how a currency merges");
n = C.normalizeCurrency(C.sanitizeCurrencies(undefined), { c0: 99999 });
ok(n.c0 === 99999, "A currency that doesn't merge just keeps its amount");

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
