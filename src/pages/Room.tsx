// src/pages/Room.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ensureAnon, doc, getDoc } from '@/lib/firebase';
import {
  joinLobby,
  setNickname as setNickOnServer,
  setReady as setReadyOnServer,
  subscribe,
  actAccept,
  actCheck,
  actFold,
  actSnap,
  actShowOrMuck,
  autoAdvanceIfDeadlinePassed,
  sendChat,
} from '@/lib/gameService';
import type { Card, GameDoc, FeedItem } from '@/types';
import PlayingCard from '@/components/PlayingCard';
import { stakesEmoji, stakesCap } from '@/lib/utils';
import { bestHand7WithCards, handLabel } from '@/lib/poker';

export default function Room() {
  const { code = '' } = useParams();
  const [game, setGame] = useState<GameDoc | null>(null);
  const [uid, setUid] = useState<string>('');
  const [notFound, setNotFound] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const user = await ensureAnon();
      setUid(user.uid);

      const ref = doc((await import('@/lib/firebase')).db, 'lobbies', code);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      setNotFound(false);

      const g = snap.data() as GameDoc;
      // Join if I'm neither A nor B yet
      if (g.playerA?.uid !== user.uid && g.playerB?.uid !== user.uid) {
        try {
          await joinLobby(code, user.uid);
        } catch {}
      }
      unsub = subscribe(code, setGame);
    })();
    return () => unsub();
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => {
      if (code) autoAdvanceIfDeadlinePassed(code).catch(() => {});
    }, 1000);
    return () => clearInterval(t);
  }, [code]);

  if (notFound)
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="toast">Lobby doesn't exist.</div>
        <div className="card p-6 max-w-md w-full text-center space-y-3">
          <div className="text-lg font-semibold">We couldn't find that lobby</div>
          <div className="text-slate-300">
            The lobby code <span className="mono">{code}</span> was not found.
          </div>
          <button className="btn btn-primary w-full" onClick={() => nav('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );

  if (!game) return <div className="p-6">Loading...</div>;
  return game.started ? <Game game={game} uid={uid} /> : <Lobby game={game} uid={uid} code={code} />;
}

function Lobby({ game, uid, code }: { game: GameDoc; uid: string; code: string }) {
  const nav = useNavigate();
  const me = game.playerA?.uid === uid ? game.playerA : game.playerB?.uid === uid ? game.playerB : null;
  const [nickname, setNicknameLocal] = useState(me?.nickname ?? '');
  useEffect(() => setNicknameLocal(me?.nickname ?? ''), [me?.nickname]);

  const link = `${window.location.origin}/${game.code}`;

  async function ensureJoined() {
    const amA = game.playerA?.uid === uid;
    const amB = game.playerB?.uid === uid;
    if (!amA && !amB) {
      try {
        await joinLobby(code, uid);
      } catch {}
    }
  }

  async function saveNick() {
    await ensureJoined();
    const n = nickname.trim() || (me?.uid === game.playerA?.uid ? 'Player 1' : 'Player 2');
    await setNickOnServer(code, uid, n);
    setNicknameLocal(n);
  }

  async function toggleReady() {
    await ensureJoined();
    const ready = !(me?.ready ?? false);
    await setReadyOnServer(code, uid, ready);
  }

  const readyCount = (game.playerA?.ready ? 1 : 0) + (game.playerB?.ready ? 1 : 0);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center md:text-left">Snap Poker</h1>

      <div className="card p-4 space-y-2">
        <div className="text-sm">Share</div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-mono">{game.code}</div>
          <button onClick={() => navigator.clipboard.writeText(game.code)} className="btn-icon" title="Copy code">
            📋
          </button>
          <div className="flex-1" />
          <div className="mono text-xs md:text-sm bg-slate-900 px-2 py-1 rounded overflow-x-auto whitespace-nowrap">
            {link}
          </div>
          <button onClick={() => navigator.clipboard.writeText(link)} className="btn-icon" title="Copy link">
            📋
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-2">
        <div className="text-sm text-slate-300">Set Nickname</div>
        <div className="flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNicknameLocal(e.target.value)}
            className="flex-1 bg-slate-800 rounded-xl p-2 border border-slate-600"
            placeholder="e.g. Daniel Negreanu"
          />
          <button onClick={saveNick} className="btn">
            OK
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Players</h2>
        <ul className="space-y-1">
          <li>• <b>{game.playerA?.nickname || 'Waiting...'}</b> {game.playerA?.ready ? '— ready' : ''}</li>
          <li>• <b>{game.playerB?.nickname || 'Waiting...'}</b> {game.playerB?.ready ? '— ready' : ''}</li>
        </ul>
        <div className="text-xs text-slate-300">{readyCount}/2 players ready</div>
        <div className="flex gap-2">
          <button onClick={toggleReady} className="btn btn-primary flex-1">
            {me?.ready ? 'Cancel Ready' : 'Start Game'}
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <button className="btn btn-danger text-white" onClick={() => nav('/')}>
          Leave Lobby
        </button>
      </div>
    </div>
  );
}

function Game({ game, uid }: { game: GameDoc; uid: string }) {
  const me = useMemo(
    () => (game.playerA?.uid === uid ? game.playerA : game.playerB?.uid === uid ? game.playerB : null),
    [game, uid],
  );
  const opp = useMemo(
    () => (game.playerA?.uid !== uid ? game.playerA : game.playerB?.uid !== uid ? game.playerB : null),
    [game, uid],
  );
  const myTurn = game.toActUid === uid;
  const cap = stakesCap(game);
  const atCap = game.stakes >= cap;

  const canSnap = myTurn && !!me && !me.snapUsed && game.stakes < cap;
  const respondingToSnap = myTurn && !!game.snapPending && game.snapPending.byUid !== uid;
  const canSnapBack = respondingToSnap && !!me && !me.snapUsed && game.stakes < cap;

  async function onCheck() {
    if (!myTurn) return;
    await actCheck(game.code, uid);
  }
  async function onSnap() {
    if (!(canSnap || canSnapBack)) return;
    await actSnap(game.code, uid);
  }
  async function onAccept() {
    if (!respondingToSnap) return;
    await actAccept(game.code, uid);
  }
  async function onFold() {
    if (!myTurn) return;
    await actFold(game.code, uid);
  }
  async function onShow() {
    await actShowOrMuck(game.code, uid, true);
  }

  // Stakes badge animation state
  const [lastStakes, setLastStakes] = useState(game.stakes);
  useEffect(() => setLastStakes(game.stakes), [game.stakes]);
  const stakesGlow =
    !!game.snapPending ||
    (game.phase === 'RIVER' && !game.snapPending && (game.actedThisPhase?.length === 1) && game.lastAction?.action === 'CHECK');

  // Best-hand & highlights
  const board: Card[] = [
    ...(game.community.flop || []),
    ...(game.community.turn ? [game.community.turn] : []),
    ...(game.community.river ? [game.community.river] : []),
  ];
  const myBest = me && (me.hole?.length ?? 0) >= 2 ? bestHand7WithCards([...(me!.hole || []), ...board]) : null;
  const myLabel = myBest ? handLabel(myBest.rank) : '';
  const holeHighlights = myBest ? [0, 1].map((i) => myBest.indices.includes(i)) : [false, false];
  const boardHighlights = myBest ? board.map((_, i) => myBest.indices.includes(i + 2)) : board.map(() => false);

  const oppShown = (() => {
    const pr = game.postRound;
    const oppUid = opp?.uid || '';
    return (
      !!pr &&
      ((pr.state === 'SHOWDOWN' && (!pr.revealAt || pr.revealAt <= Date.now()) && pr.winnerUid === oppUid) ||
        (pr.show && pr.show[oppUid] === true))
    );
  })();
  const oppBest = oppShown && opp?.hole?.length === 2 ? bestHand7WithCards([...(opp.hole || []), ...board]) : null;
  const oppLabel = oppBest ? handLabel(oppBest.rank) : '';

  // Chat / Log feed (append-only rendering)
  const [chatText, setChatText] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [game.feed?.length]);

  function normalizeSys(text: string) {
    return text
      .replace(/snap backs?/i, 'snaps back!')
      .replace(/\s*\(stakes?\s*×?x?2\)/gi, '')
      .trim();
  }

  // Order strictly by timestamp
  const orderedFeed = useMemo(
    () => ([...(game.feed ?? [])].sort((a, b) => (a.at || 0) - (b.at || 0))),
    [game.feed],
  );

  // Drop raw "X folds." if a summary appears immediately after; keep order intact otherwise
  const filteredFeed = useMemo(() => {
    const rendered = orderedFeed.map((f) => ({
      ...f,
      _text: f.sys ? normalizeSys(f.text) : f.text,
    }));
    const out: typeof rendered = [];
    for (let i = 0; i < rendered.length; i++) {
      const cur = rendered[i];
      if (cur.sys && /folds\.$/i.test(cur._text)) {
        const nextFew = rendered.slice(i + 1, i + 4).map((x) => x._text.toLowerCase());
        const hasSummary = nextFew.some((t) => /folded\.\s.*lost\s+\d+\s+(life|lives)/i.test(t));
        if (hasSummary) continue;
      }
      out.push(cur);
    }
    return out;
  }, [orderedFeed]);

  const isIP = (whoUid: string) => whoUid === game.inPositionUid;

  const actionButtons =
    myTurn && !game.postRound ? (
      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
        {!respondingToSnap && <button onClick={onCheck} className="btn">Check</button>}
        {!respondingToSnap && canSnap && <button onClick={onSnap} className="btn btn-primary">Snap</button>}
        {respondingToSnap && (
          <>
            <button onClick={onAccept} className="btn btn-primary">Call</button>
            {canSnapBack && <button onClick={onSnap} className="btn">Snap Back</button>}
          </>
        )}
        <button onClick={onFold} className="btn btn-danger">Fold</button>
      </div>
    ) : !game.postRound ? (
      <div className="text-sm text-slate-300 text-center">Opponent&apos;s turn…</div>
    ) : (
      <PostRoundPanel game={game} uid={uid} onShow={onShow} />
    );

  // Chat state + handler (must be inside Game)
  const send = React.useCallback(async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    const item: FeedItem = { uid, nick: me?.nickname || 'You', text, at: Date.now() };
    await sendChat(game.code, item);
  }, [chatText, uid, me?.nickname, game.code]);


  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Snap Poker</h1>
        <div className="flex items-center gap-3">
          <div className="pill">Round: {game.round}</div>
          <div className="pill">Phase: {game.phase}</div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8 space-y-4">
          {/* Opponent panel — tighter vertical padding on mobile (no scaling) */}
          <div className={`card py-1.5 px-2 md:p-4 ${!game.postRound && game.toActUid === opp?.uid ? 'turn-active' : ''}`}>
            <div className="grid md:grid-cols-2 items-center gap-3">
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2 w-full">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="text-base font-bold">{opp?.nickname ?? 'Opponent'}</span>
                  {isIP(opp?.uid || '') && <span title="Button">🔘</span>}
                  <span className="pill"><span className="heart">♥</span> {opp?.lives ?? 10}</span>
                  <span className="pill">{atCap && !opp?.snapUsed ? '🔋 Max Stakes' : opp?.snapUsed ? '⚡ Snapped' : '⏳ Snap Ready'}</span>
                </div>

                {/* Opponent hole cards — reduce vertical padding, no scale */}
                <div className="w-full md:hidden">
                  {oppShown ? (
                    <div className="grid grid-cols-2 items-center gap-2">
                      <div className="flex gap-2 justify-center py-0.5">
                        <PlayingCard card={opp?.hole?.[0] ?? { r: 14, s: 'S' }} hidden={false} />
                        <PlayingCard card={opp?.hole?.[1] ?? { r: 2, s: 'H' }} hidden={false} />
                      </div>
                      {oppLabel && (
                        <div className="text-xs text-slate-300 text-center md:text-left">
                          Opponent&apos;s best hand: <b>{oppLabel}</b>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-center py-0.5">
                      <PlayingCard card={opp?.hole?.[0] ?? { r: 14, s: 'S' }} hidden />
                      <PlayingCard card={opp?.hole?.[1] ?? { r: 2, s: 'H' }} hidden />
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop: opponent cards + label */}
              <div className="hidden md:flex flex-col items-center gap-2">
                <div className="flex gap-3">
                  <PlayingCard card={opp?.hole?.[0] ?? { r: 14, s: 'S' }} hidden={!oppShown} />
                  <PlayingCard card={opp?.hole?.[1] ?? { r: 2, s: 'H' }} hidden={!oppShown} />
                </div>
                {oppShown && oppLabel && (
                  <div className="text-xs text-slate-300">Opponent&apos;s best hand: <b>{oppLabel}</b></div>
                )}
              </div>
            </div>
          </div>

          {/* Board + stakes — compact padding, stakes sized to content */}
          <div className="card px-2.5 py-3 lg:p-6 relative">
            <div
              className={`flex items-center justify-center w-fit px-2.5 py-0.5 rounded-xl mb-2 mx-auto text-center
                ${stakesGlow ? 'turn-active' : ''}
                lg:absolute lg:left-3 lg:top-1/2 lg:-translate-y-1/2 lg:mx-0 lg:mb-0
                ${lastStakes !== game.stakes || !!game.snapPending ? 'bump' : ''}`}
            >
              <span>Stakes: {game.stakes}</span>
              <span className="ml-2">{stakesEmoji(game.stakes)}</span>
            </div>
            <Board community={game.community} boardHighlights={boardHighlights} />
          </div>

          {/* Me panel */}
          <div className={`card p-4 ${!game.postRound && game.toActUid === uid ? 'turn-active' : ''}`}>
            <div className="grid md:grid-cols-2 items-center gap-3">
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2 w-full">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="text-base font-bold">{me?.nickname ?? 'You'}</span>
                  {isIP(me?.uid || '') && <span title="Button">🔘</span>}
                  <span className="pill"><span className="heart">♥</span> {me?.lives ?? 10}</span>
                  <span className="pill">{atCap && !me?.snapUsed ? '🔋 Max Stakes' : me?.snapUsed ? '⚡ Snapped' : '⏳ Snap Ready'}</span>
                </div>

                {/* My hole cards (mobile) — tighter padding, no scale */}
                <div className="grid grid-cols-2 items-center gap-2 md:hidden w-full">
                  <div className="flex gap-2 justify-center py-0.5">
                    <PlayingCard card={me?.hole?.[0] ?? { r: 14, s: 'H' }} highlight={holeHighlights[0]} />
                    <PlayingCard card={me?.hole?.[1] ?? { r: 13, s: 'H' }} highlight={holeHighlights[1]} />
                  </div>
                  {myLabel && (
                    <div className="text-xs text-slate-300 text-center md:text-left">
                      Your best hand: <b>{myLabel}</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop: my cards + label */}
              <div className="hidden md:flex flex-col items-center gap-2">
                <div className="flex gap-3">
                  <PlayingCard card={me?.hole?.[0] ?? { r: 14, s: 'H' }} highlight={holeHighlights[0]} />
                  <PlayingCard card={me?.hole?.[1] ?? { r: 13, s: 'H' }} highlight={holeHighlights[1]} />
                </div>
                {myLabel && <div className="text-xs text-slate-300">Your best hand: <b>{myLabel}</b></div>}
              </div>
            </div>
          </div>

          <div>{actionButtons}</div>
        </div>

        <div className="col-span-12 md:col-span-4">
          <div className="sidebar">
            <div className="font-semibold mb-1">Chat</div>
            <div ref={feedRef} className="feed overflow-y-auto">
              {filteredFeed.map((f, i) =>
                f.sys ? (
                  <div key={f.at ?? i} className="sys">• {f._text}</div>
                ) : (
                  <div key={`c${f.at ?? i}`} className="chat"><b>{f.nick}:</b> {f.text}</div>
                )
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 bg-slate-800 rounded-xl p-2 border border-slate-600"
                placeholder="Type a message…"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              />
              <button className="btn" onClick={send}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Board({
  community,
  boardHighlights,
}: {
  community: GameDoc['community'];
  boardHighlights: boolean[];
}) {
  const flop = community.flop ?? [];
  const turn = community.turn ? [community.turn] : [];
  const river = community.river ? [community.river] : [];
  const hiddenCount = 5 - (flop.length + turn.length + river.length);
  const hiddenCards: Card[] = Array.from({ length: hiddenCount }, () => ({ r: 2 as const, s: 'C' as const }));
  const highlights = [...flop, ...turn, ...river].map((_, i) => boardHighlights[i]);

  return (
    <div className="flex items-center justify-center gap-1.5 md:gap-3">
      {flop.map((c, i) => <PlayingCard key={'f' + i} card={c} highlight={highlights[i]} />)}
      {turn.map((c, i) => <PlayingCard key={'t' + i} card={c} highlight={highlights[flop.length + i]} />)}
      {river.map((c, i) => (
        <PlayingCard key={'r' + i} card={c} highlight={highlights[flop.length + turn.length + i]} />
      ))}
      {hiddenCards.map((c, i) => <PlayingCard key={'h' + i} card={c} hidden />)}
    </div>
  );
}

function PostRoundPanel({
  game,
  uid,
  onShow,
}: {
  game: GameDoc;
  uid: string;
  onShow: () => any;
}) {
  const pr = game.postRound!;
  const iAmWinner = pr.winnerUid === uid;
  const iAmLoser = pr.loserUid === uid;
  const tie = pr.loss === 0 && !pr.winnerUid && !pr.loserUid;

  // End-of-match banner
  const a = game.playerA, b = game.playerB;
  const matchOver = !!a && !!b && (a.lives <= 0 || b.lives <= 0);
  const winner = matchOver ? (a.lives > 0 ? a : b.lives > 0 ? b : null) : null;

  let text = '';
  if (matchOver && winner) {
    text = `${winner.nickname || (winner.uid === a?.uid ? 'Player 1' : 'Player 2')} wins the match!`;
  } else if (pr.state === 'FOLD') {
    text =
      uid === pr.loserUid
        ? `You folded. You lost ${pr.loss} ${pr.loss === 1 ? 'life' : 'lives'}`
        : `Your opponent folded. They lost ${pr.loss} ${pr.loss === 1 ? 'life' : 'lives'}`;
  } else if (pr.state === 'SHOWDOWN') {
    if (tie) text = 'Tie — no life loss.';
    else
      text = iAmWinner
        ? `You won! Your opponent lost ${pr.loss} ${pr.loss === 1 ? 'life' : 'lives'}`
        : `Your opponent won. You lose ${pr.loss} ${pr.loss === 1 ? 'life' : 'lives'}`;
  }

  // After a fold, both players may choose to show; after showdown, only the loser
  const showBtn = (pr.state === 'FOLD') || (pr.state === 'SHOWDOWN' && iAmLoser);

  return (
    <div className="card p-4 space-y-3">
      <div className="text-sm text-center">{text}</div>
      {showBtn && (
        <div className="flex gap-2 mt-1 justify-center">
          <button onClick={onShow} className="btn btn-primary">Show</button>
        </div>
      )}
    </div>
  );
}
