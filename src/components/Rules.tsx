
import React from 'react';
export default function Rules(){
  return (<div className="space-y-4">
    <h2 className="text-xl font-semibold">How to Play Snap Poker</h2>
    <ul className="list-disc pl-6 space-y-1 text-slate-300">
    <li><b>Objective:</b> 1v1 with 10 lives each, reduce the opponent to 0</li>
    <li><b>Setup:</b> 52-card deck: 2 hole + 5 community cards. Position alternates each round</li>
    <li><b>Flow:</b> Flop shown → bet; Turn → bet; River → bet; Showdown</li>
    <li><b>Actions:</b> Stakes start at 1. Check (no change), Snap (x2), Call (accept snap), Fold (lose current stakes)</li>
    <li><b>Snapping:</b> One Snap per player per round; you may Snap Back when snapped. The Stakes display will glow when about to double. Stakes never exceed the lower player's lives</li>
    <li><b>River Auto-Double:</b> If both remain after river betting, stakes double (respecting cap) before showdown.</li>
    <li><b>Round End:</b> Showdown: best 5-card hand wins, loser loses final stakes. On fold: immediate loss = stakes</li>
    </ul>
    <br></br>
    <p className="text-sm text-slate-400">Made by <a href="https://github.com/cyin100" target="_blank" rel="noreferrer" className="underline">Conner Yin</a>. The snap mechanic is inspired by the hit mobile game <a href="https://marvelsnap.com" target="_blank" rel="noreferrer" className="underline">Marvel Snap</a>.</p>
  </div>);
}
