
import React from 'react';
import type { Card } from '@/types';
import { toLabel, toImageCode } from '@/lib/deck';
export default function PlayingCard({ card, hidden=false, big=false, highlight=false }:{ card:Card, hidden?:boolean, big?:boolean, highlight?:boolean }){
  if(hidden){ return (<div className={`playing-card ${big?'big':''} ${highlight?'highlight':''}`}><div className="card-back"></div></div>); }
  const url=`https://deckofcardsapi.com/static/img/${toImageCode(card)}.png`;
  return (<div className={`playing-card ${big?'big':''} ${highlight?'highlight':''}`} title={toLabel(card)}><img src={url} alt={toLabel(card)} className="card-img"/></div>);
}
