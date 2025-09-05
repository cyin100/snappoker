
import type { Card } from '@/types';

export type HandRank = { cat: number; kickers: number[]; };
export type BestWithCards = { rank: HandRank; indices: number[]; };

export function bestHand7(cards: Card[]): HandRank { return bestHand7WithCards(cards).rank; }

export function bestHand7WithCards(cards: Card[]): BestWithCards {
  const n = cards.length;
  if (n < 5) throw new Error('Need at least 5 cards to evaluate');
  if (n > 7) return bestHand7WithCards(cards.slice(0, 7));
  if (n === 5) return { rank: rank5(cards), indices: [0,1,2,3,4] };
  if (n === 6) {
    let best: BestWithCards | null = null;
    for (let drop = 0; drop < 6; drop++) {
      const pick = [0,1,2,3,4,5].filter(i => i !== drop);
      const hand = pick.map(i => cards[i]);
      const rank = rank5(hand);
      if (!best || compareRank(rank, best.rank) > 0) best = { rank, indices: pick };
    }
    return best!;
  }
  let best: BestWithCards | null = null;
  const idx = [0,1,2,3,4,5,6];
  for (let a=0;a<3;a++) for (let b=a+1;b<4;b++) for (let c=b+1;c<5;c++) for (let d=c+1;d<6;d++) for (let e=d+1;e<7;e++) {
    const pick=[idx[a],idx[b],idx[c],idx[d],idx[e]];
    const hand=pick.map(i=>cards[i]);
    const rank=rank5(hand);
    if(!best || compareRank(rank,best.rank)>0) best={rank,indices:pick};
  }
  return best!;
}

export function compareRank(a: HandRank, b: HandRank): number {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i=0;i<len;i++){ const av=a.kickers[i]??0, bv=b.kickers[i]??0; if(av!==bv) return av-bv; }
  return 0;
}

function rank5(hand: Card[]): HandRank {
  const byR = hand.map(c=>c.r).sort((a,b)=>b-a);
  const counts = countRanks(hand);
  const isFlush = flushSuit(hand) !== null;
  const straightHigh = straightHighCard(hand);

  if (isFlush && straightHigh) {
    if (straightHigh === 14) return { cat: 9, kickers: [14] };
    return { cat: 8, kickers: [straightHigh] };
  }

  const four = ofAKind(counts, 4);
  if (four) { const kicker=byR.filter(r=>r!==four)[0]; return { cat: 7, kickers: [four, kicker] }; }

  const three = ofAKind(counts, 3);
  const pair  = ofAKind(counts, 2, three ?? undefined);
  if (three && pair) return { cat: 6, kickers: [three, pair] };

  if (isFlush) return { cat: 5, kickers: byR };

  if (straightHigh) return { cat: 4, kickers: [straightHigh] };

  if (three) { const kickers=byR.filter(r=>r!==three).slice(0,2); return { cat: 3, kickers: [three, ...kickers] }; }

  const pairs = pairsDescending(counts);
  if (pairs.length >= 2) { const [p1,p2]=pairs.slice(0,2); const kicker=byR.filter(r=>r!==p1&&r!==p2)[0]; return { cat: 2, kickers: [p1,p2,kicker] }; }

  if (pairs.length === 1) { const [p]=pairs; const kick=byR.filter(r=>r!==p).slice(0,3); return { cat: 1, kickers: [p, ...kick] }; }

  return { cat: 0, kickers: byR };
}

function countRanks(hand: Card[]): Record<number,number> { const m:Record<number,number>={}; for(const c of hand) m[c.r]=(m[c.r]??0)+1; return m; }
function ofAKind(counts:Record<number,number>, n:number, exclude?:number):number|null { for(let r=14;r>=2;r--){ if(r===exclude) continue; if((counts[r]??0)===n) return r; } return null; }
function pairsDescending(counts:Record<number,number>):number[]{ const arr:number[]=[]; for(let r=14;r>=2;r--) if((counts[r]??0)===2) arr.push(r); return arr; }
function flushSuit(hand:Card[]):string|null{ const counts:Record<string,number>={}; for(const c of hand) counts[c.s]=(counts[c.s]??0)+1; for(const s of Object.keys(counts)) if(counts[s]>=5) return s; return null; }
function straightHighCard(hand:Card[]):number|null{
  const ranksSet=new Set(hand.map(c=>c.r));
  for(let hi=14;hi>=5;hi--){ const seq=[hi,hi-1,hi-2,hi-3,hi-4]; if(seq.every(r=>ranksSet.has(r))) return hi; }
  if(ranksSet.has(14)&&ranksSet.has(5)&&ranksSet.has(4)&&ranksSet.has(3)&&ranksSet.has(2)) return 5;
  return null;
}

export function handLabel(rank: HandRank): string {
  const names=['High Card','Pair','Two Pair','Trips','Straight','Flush','Full House','Four of a Kind','Straight Flush','Royal Flush'];
  return names[rank.cat] ?? 'Hand';
}
