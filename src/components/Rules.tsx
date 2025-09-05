
import React from 'react';
export default function Rules(){
  return (<div className="space-y-4">
    <h2 className="text-xl font-semibold">How to Play Snap Poker</h2>
    <ul className="list-disc pl-6 space-y-1 text-slate-300">
      <li>1v1. Each player starts at <b>10 lives</b>.</li>
      <li>Phases: <b>Flop</b> (dealt & revealed), <b>Turn</b>, <b>River</b>.</li>
      <li>Positions alternate each round: <b>OOP</b> first, <b>IP</b> second.</li>
      <li>Stakes begin at <b>1</b>. Actions each betting phase: <span className="pill">Check</span>, <span className="pill">Snap</span>, <span className="pill">Fold</span>.</li>
      <li><b>Snap</b>: opponent must <i>Call</i> (stakes ×2; phase ends) or <i>Fold</i> (pays current stakes). Facing a snap you may also <b>Snap Back</b>.</li>
      <li><b>River</b> if no one folds: stakes auto ×2 once, then showdown after a brief reveal delay.</li>
      <li><b>Cap</b>: stakes can never exceed the lower player’s remaining lives.</li>
      <li>Showdown: best 5 of available cards; loser loses current stakes. Winner’s hand is always revealed on both screens. Loser may optionally show.</li>
      <li>After a fold, either player may optionally show. Next round auto-deals shortly.</li>
    </ul>
  </div>);
}
