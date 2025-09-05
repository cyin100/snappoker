
import { db, doc, getDoc, setDoc, updateDoc, onSnapshot } from '@/lib/firebase';
import { freshDeck, shuffle, draw } from '@/lib/deck';
import { bestHand7, compareRank } from '@/lib/poker';
import type { Card, GameDoc, PlayerState, FeedItem } from '@/types';
import { stakesCap as calcCap } from '@/lib/utils';

function getPlayers(g:GameDoc){ if(!g.playerA||!g.playerB) throw new Error('Two players required'); const ip=g.inPositionUid===g.playerA.uid?g.playerA:g.playerB; const oop=g.inPositionUid===g.playerA.uid?g.playerB:g.playerA; return {ip,oop}; }
function nextInPosition(g:GameDoc):string{ if(!g.playerA||!g.playerB||!g.inPositionUid) throw new Error('Missing players'); return g.inPositionUid===g.playerA.uid?g.playerB.uid:g.playerA.uid; }
function playerByUid(g:GameDoc, uid:string):PlayerState{ if(g.playerA?.uid===uid) return g.playerA; if(g.playerB?.uid===uid) return g.playerB; throw new Error('Player not in game'); }
function nameByUid(g:GameDoc, uid:string):string{ const p=playerByUid(g,uid); return p.nickname || (p.uid===g.playerA?.uid ? 'Player 1':'Player 2'); }
function oppUid(g:GameDoc, uid:string):string{ const a=g.playerA!, b=g.playerB!; return a.uid===uid?b.uid:a.uid; }
function clampStake(g:GameDoc, candidate:number){ return Math.min(candidate, calcCap(g)); }
function feedAdd(feed:FeedItem[]|undefined, item:FeedItem){ const arr=(feed??[]).slice(-200); return arr.concat(item); }
function feedSys(g:GameDoc, text:string):FeedItem{ return {sys:true, uid:'sys', nick:'•', text, at:Date.now()}; }

export async function createLobby(code:string, hostUid:string):Promise<GameDoc>{
  const ref=doc(db,'lobbies',code); const exists=await getDoc(ref); if(exists.exists()) throw new Error('Code already in use. Try again.');
  const deck=shuffle(freshDeck()); const [holeA,d1]=draw(deck,2); const [holeB,d2]=draw(d1,2); const [flop,d3]=draw(d2,3);
  const playerA:PlayerState={uid:hostUid,nickname:'Player 1',lives:10,hole:holeA,snapUsed:false,ready:false};
  const game:GameDoc={code,hostUid,playerA,playerB:null,pendingHoleB:holeB,started:false,inPositionUid:hostUid,toActUid:null,phase:'FLOP',stakes:1,snapPending:null,lastAction:null,community:{flop},deck:d3,round:1,winnerUid:null,version:6,createdAt:Date.now(),updatedAt:Date.now(),actedThisPhase:[],postRound:null,feed:[feedSys({} as any,'Lobby created. Share code to invite.')]};
  await setDoc(ref,game); return game;
}

export async function setNickname(code:string, uid:string, nickname:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc;
  if(g.playerA?.uid===uid) await updateDoc(ref,{ 'playerA.nickname': nickname, updatedAt:Date.now() } as any);
  else if(g.playerB?.uid===uid) await updateDoc(ref,{ 'playerB.nickname': nickname, updatedAt:Date.now() } as any);
  else throw new Error('Not in lobby');
}

export async function setReady(code:string, uid:string, ready:boolean){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc;
  const feed=feedAdd(g.feed, feedSys(g, `${nameByUid(g,uid)} is ${ready?'ready':'not ready'}.`));
  if(g.playerA?.uid===uid) await updateDoc(ref,{ 'playerA.ready': ready, updatedAt:Date.now(), feed } as any);
  else if(g.playerB?.uid===uid) await updateDoc(ref,{ 'playerB.ready': ready, updatedAt:Date.now(), feed } as any);
  const snap2=await getDoc(ref); const g2=snap2.data() as GameDoc; if(g2.playerA?.ready && g2.playerB?.ready){ await startGame(code); }
}

export async function joinLobby(code:string, uid:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found');
  const g=snap.data() as GameDoc;
  // If I'm already A or B, do nothing
  if(g.playerA?.uid===uid) return;
  if(g.playerB?.uid===uid) return;
  // If B is taken by someone else, deny
  if(g.playerB && g.playerB.uid!==uid) throw new Error('Lobby already full');
  // If I'm the host (player A), do not populate B
  if(g.playerA && g.playerA.uid===uid) return;
  // Otherwise create Player B for this uid
  const playerB:PlayerState={uid,nickname:'Player 2',lives:10,hole:g.pendingHoleB??[],snapUsed:false,ready:false};
  const feed=feedAdd(g.feed, feedSys(g,'Player 2 joined.'));
  await updateDoc(ref,{playerB,updatedAt:Date.now(),feed});
}

export async function startGame(code:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found');
  const g=snap.data() as GameDoc; if(!g.playerA||!g.playerB) throw new Error('Need two players');
  const needsReset=(g.playerA.lives<=0||g.playerB.lives<=0);
  const deck=shuffle(freshDeck()); const [holeA,d1]=draw(deck,2); const [holeB,d2]=draw(d1,2); const [flop,d3]=draw(d2,3);
  const nextIP=needsReset?g.hostUid:(g.inPositionUid||g.hostUid); const oop=(nextIP===g.playerA.uid)?g.playerB.uid:g.playerA.uid;
  const playerA={...g.playerA,hole:holeA,lives:needsReset?10:g.playerA.lives,snapUsed:false,ready:false};
  const playerB={...g.playerB,hole:holeB,lives:needsReset?10:g.playerB.lives,snapUsed:false,ready:false};
  const feed=feedAdd(g.feed, feedSys(g, `Game started. ${nameByUid({ ...g, playerA, playerB } as any, oop)} to act.`));
  await updateDoc(ref,{started:true,toActUid:oop,inPositionUid:nextIP,community:{flop},deck:d3,phase:'FLOP',stakes:1,snapPending:null,lastAction:null,actedThisPhase:[],round:needsReset?1:(g.round??1),postRound:null,playerA,playerB,updatedAt:Date.now(),feed} as any);
}

export function subscribe(code:string, cb:(g:GameDoc)=>void){ const ref=doc(db,'lobbies',code); return onSnapshot(ref,(snap)=>{ if(snap.exists()) cb(snap.data() as GameDoc); }); }

export async function sendChat(code:string, item:FeedItem){ const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc; const feed=feedAdd(g.feed,item); await updateDoc(ref,{feed,updatedAt:Date.now()}); }

export async function actCheck(code:string, uid:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc;
  if(g.toActUid!==uid) throw new Error('Not your turn');
  if(g.snapPending && g.snapPending.byUid!==uid){ return actAccept(code,uid); }
  const acted=new Set(g.actedThisPhase??[]); acted.add(uid); const bothActed=acted.size>=2;
  const feed=(g.feed??[]).concat({sys:true,uid:'sys',nick:'•',text:`${nameByUid(g,uid)} checks.`,at:Date.now()});
  const patch:any={lastAction:{byUid:uid,action:'CHECK',at:Date.now()},actedThisPhase:Array.from(acted),updatedAt:Date.now(),feed};
  if(!bothActed) patch.toActUid=oppUid(g,uid); else advancePhaseMutate(g,patch);
  await updateDoc(ref,patch);
}

export async function actSnap(code:string, uid:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc;
  if(g.toActUid!==uid) throw new Error('Not your turn'); const me=playerByUid(g,uid); if(me.snapUsed) throw new Error('You already snapped this round');
  const patch:any={updatedAt:Date.now()}; let feed=g.feed??[];
  if(g.snapPending && g.snapPending.byUid!==uid){
    const newStakes=Math.min(g.stakes*2, calcCap(g)); patch.stakes=newStakes; patch.snapPending={byUid:uid}; patch.lastAction={byUid:uid,action:'SNAP',at:Date.now()}; patch.toActUid=oppUid(g,uid);
    feed=feed.concat({sys:true,uid:'sys',nick:'•',text:`${nameByUid(g,uid)} snap backs! (stakes ×2)`,at:Date.now()});
  } else {
    patch.snapPending={byUid:uid}; patch.lastAction={byUid:uid,action:'SNAP',at:Date.now()}; patch.toActUid=oppUid(g,uid);
    feed=feed.concat({sys:true,uid:'sys',nick:'•',text:`${nameByUid(g,uid)} snaps!`,at:Date.now()});
  }
  if(g.playerA?.uid===uid) patch.playerA={...g.playerA,snapUsed:true}; if(g.playerB?.uid===uid) patch.playerB={...g.playerB,snapUsed:true};
  patch.feed=feed; await updateDoc(ref,patch);
}

export async function actAccept(code:string, uid:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc;
  if(g.toActUid!==uid) throw new Error('Not your turn'); if(!g.snapPending) throw new Error('Nothing to call');
  const newStakes=Math.min(g.stakes*2, calcCap(g)); const feed=(g.feed??[]).concat({sys:true,uid:'sys',nick:'•',text:`${nameByUid(g,uid)} calls.`,at:Date.now()});
  const patch:any={snapPending:null,stakes:newStakes,lastAction:{byUid:uid,action:'ACCEPT',at:Date.now()},updatedAt:Date.now(),feed};
  advancePhaseMutate(g,patch,true); await updateDoc(ref,patch);
}

export async function actFold(code: string, uid: string) {
  const ref = doc(db, 'lobbies', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Lobby not found');
  const g = snap.data() as GameDoc;
  if (g.toActUid !== uid) throw new Error('Not your turn');

  const loss = g.stakes;
  const me = playerByUid(g, uid);
  const opp = playerByUid(g, oppUid(g, uid));
  const newLives = Math.max(0, me.lives - loss);

  // Neutral, single-line log entry
  const loserName = nameByUid(g, uid);
  const lifeWord = loss === 1 ? 'life' : 'lives';
  const at = Date.now();
  const feed = (g.feed ?? []).concat({
    sys: true,
    uid: 'sys',
    nick: '•',
    text: `${loserName} folded. They lose ${loss} ${lifeWord}.`,
    at,
  });

  const patch: any = {
    lastAction: { byUid: uid, action: 'FOLD', at },
    updatedAt: at,
    postRound: {
      state: 'FOLD',
      winnerUid: opp.uid,
      loserUid: me.uid,
      loss,
      show: { [me.uid]: null, [opp.uid]: null },
      deadlineAt: at + 10000,
    },
    toActUid: null,
    feed,
  };
  if (g.playerA?.uid === uid) patch.playerA = { ...g.playerA, lives: newLives };
  else patch.playerB = { ...g.playerB!, lives: newLives };

  await updateDoc(ref, patch);
}


export async function actShowOrMuck(code:string, uid:string, show:boolean){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) throw new Error('Lobby not found'); const g=snap.data() as GameDoc; if(!g.postRound) throw new Error('No post-round state');
  const pr=g.postRound; const newShow={...(pr.show||{})}; newShow[uid]=show; const feed=(g.feed??[]).concat({sys:true,uid:'sys',nick:'•',text:`${nameByUid(g,uid)} shows cards.`,at:Date.now()});
  await updateDoc(ref,{postRound:{...pr,show:newShow},updatedAt:Date.now(),feed} as any);
}

export async function autoAdvanceIfDeadlinePassed(code:string){
  const ref=doc(db,'lobbies',code); const snap=await getDoc(ref); if(!snap.exists()) return; const g=snap.data() as GameDoc; const pr=g.postRound; if(!pr?.deadlineAt) return; if(Date.now()<pr.deadlineAt) return;
  const a=g.playerA!, b=g.playerB!; const aAlive=a.lives>0, bAlive=b.lives>0;
  if(aAlive && bAlive){ const patch:any={updatedAt:Date.now(),postRound:null}; dealNextRoundMutate(g,patch); await updateDoc(ref,patch); }
  else { await updateDoc(ref,{started:false,toActUid:null,updatedAt:Date.now()} as any); }
}

function advancePhaseMutate(g: GameDoc, patch: any, forceAdvance = false) {
  // Always build on the already-updated feed (patch.feed),
  // falling back to g.feed only if patch.feed isn't set yet.
  const baseFeed: FeedItem[] = (patch.feed ?? g.feed ?? []).slice();
  const at = Date.now();

  if (g.phase === 'FLOP') {
    const [turnArr, d2] = draw(g.deck, 1);
    patch.community = { ...g.community, turn: turnArr[0] };
    patch.phase = 'TURN';
    patch.actedThisPhase = [];
    patch.toActUid = getPlayers(g).oop.uid;
    patch.deck = d2;
    patch.feed = baseFeed.concat({ sys: true, uid: 'sys', nick: '•', text: 'Turn dealt.', at });
  }
  else if (g.phase === 'TURN') {
    const [riverArr, d2] = draw(g.deck, 1);
    patch.community = { ...g.community, river: riverArr[0] };
    patch.phase = 'RIVER';
    patch.actedThisPhase = [];
    patch.toActUid = getPlayers(g).oop.uid;
    patch.deck = d2;
    patch.feed = baseFeed.concat({ sys: true, uid: 'sys', nick: '•', text: 'River dealt.', at });
  }
  else if (g.phase === 'RIVER' || forceAdvance) {
    let newStakes = patch.stakes ?? g.stakes;
    if (g.phase === 'RIVER') newStakes = Math.min(newStakes * 2, calcCap(g));
    patch.stakes = newStakes;

    // Build showdown messages on the same base feed
    showdownToPostRound(g, patch, newStakes, baseFeed);
  }
}


function showdownToPostRound(g: GameDoc, patch: any, stakes: number, baseFeed?: FeedItem[]) {
  const a = g.playerA!, b = g.playerB!;
  const board = [
    ...(g.community.flop ?? []),
    ...(g.community.turn ? [g.community.turn] : []),
    ...(g.community.river ? [g.community.river] : []),
  ];
  const aRank = bestHand7([...a.hole, ...board]);
  const bRank = bestHand7([...b.hole, ...board]);
  const cmp = compareRank(aRank, bRank);
  const at = Date.now();

  // Append on top of patch.feed if present, else baseFeed, else g.feed
  const seed: FeedItem[] = (patch.feed ?? baseFeed ?? g.feed ?? []).slice();

  if (cmp === 0) {
    patch.postRound = {
      state: 'SHOWDOWN',
      winnerUid: '',
      loserUid: '',
      loss: 0,
      show: { [a.uid]: true, [b.uid]: true },
      revealAt: at + 2000,
      deadlineAt: at + 10000,
    };
    patch.toActUid = null;
    patch.feed = seed.concat({ sys: true, uid: 'sys', nick: '•', text: 'Showdown: tie.', at });
    return;
  }

  const loser = cmp < 0 ? a : b;
  const winner = loser.uid === a.uid ? b : a;

  const newLives = Math.max(0, loser.lives - stakes);
  if (loser.uid === a.uid) patch.playerA = { ...a, lives: newLives };
  else patch.playerB = { ...b, lives: newLives };

  const winnerName = nameByUid(g, winner.uid);
  const loserName = nameByUid(g, loser.uid);
  const lifeWord = stakes === 1 ? 'life' : 'lives';

  patch.postRound = {
    state: 'SHOWDOWN',
    winnerUid: winner.uid,
    loserUid: loser.uid,
    loss: stakes,
    show: { [winner.uid]: true, [loser.uid]: null },
    revealAt: at + 2000,
    deadlineAt: at + 10000,
  };
  patch.toActUid = null;
  patch.feed = seed.concat({
    sys: true,
    uid: 'sys',
    nick: '•',
    text: `Showdown. ${winnerName} wins! ${loserName} loses ${stakes} ${lifeWord}.`,
    at,
  });
}

function dealNextRoundMutate(g:GameDoc, patch:any){
  const deck=shuffle(freshDeck()); const [holeA,d1]=draw(deck,2); const [holeB,d2]=draw(d1,2); const [flop,d3]=draw(d2,3); const nextIP=nextInPosition(g); const a=g.playerA!, b=g.playerB!;
  patch.playerA={...a,hole:holeA,snapUsed:false,ready:false}; patch.playerB={...b,hole:holeB,snapUsed:false,ready:false}; const oopUid=(nextIP===a.uid)?b.uid:a.uid;
  patch.community={flop}; patch.deck=d3; patch.phase='FLOP'; patch.inPositionUid=nextIP; patch.toActUid=oopUid; patch.stakes=1; patch.snapPending=null; patch.lastAction=null; patch.round=(g.round??1)+1; patch.actedThisPhase=[]; patch.updatedAt=Date.now(); patch.winnerUid=null;
  patch.feed=(g.feed??[]).concat({sys:true,uid:'sys',nick:'•',text:`Round ${patch.round} started. ${nameByUid(g, oopUid)} to act`,at:Date.now()});
}
