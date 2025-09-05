
import type { Card, Rank, Suit } from '@/types';
const suits: Suit[] = ['S','H','D','C'];
const ranks: Rank[] = [2,3,4,5,6,7,8,9,10,11,12,13,14];
export function freshDeck(): Card[] { const d:Card[]=[]; for(const s of suits) for(const r of ranks) d.push({r,s}); return d; }
export function shuffle<T>(arr:T[], seed?:number):T[]{ const a=arr.slice(); let rng=seedRandom(seed??Date.now()); for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function seedRandom(seed:number){ let s=seed%2147483647; if(s<=0)s+=2147483646; return function(){ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
export function draw(deck:Card[], n:number):[Card[],Card[]]{ return [deck.slice(0,n), deck.slice(n)]; }
export function toLabel(card:Card){ const rank=card.r===14?'A':card.r===13?'K':card.r===12?'Q':card.r===11?'J':String(card.r); const suit=card.s==='S'?'♠':card.s==='H'?'♥':card.s==='D'?'♦':'♣'; return rank+suit; }
export function toImageCode(card:Card){ const rank=card.r===14?'A':card.r===13?'K':card.r===12?'Q':card.r===11?'J':(card.r===10?'0':String(card.r)); return rank+card.s; }
