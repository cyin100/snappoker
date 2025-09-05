
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ensureAnon } from '@/lib/firebase';
import { shortCode } from '@/lib/utils';
import { createLobby } from '@/lib/gameService';
import Rules from '@/components/Rules';

export default function Home(){
  const [creating,setCreating]=useState(false); const [joinCode,setJoinCode]=useState('');
  const nav=useNavigate(); useEffect(()=>{ ensureAnon().catch(console.error); },[]);
  async function handleCreate(){ setCreating(true); try{ const user=await ensureAnon(); const code=shortCode(4); await createLobby(code,user.uid); nav('/'+code); }catch(e:any){ alert(e.message||String(e)); } finally{ setCreating(false); } }
  return (<div className="max-w-4xl mx-auto p-6 space-y-8">
    <header className="flex items-center justify-between"><h1 className="text-3xl font-bold">Snap Poker</h1></header>
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-6 space-y-4"><h2 className="text-xl font-semibold">Create lobby</h2><button disabled={creating} onClick={handleCreate} className="btn btn-primary w-full">{creating?'Creating...':'Create Lobby'}</button></div>
      <div className="card p-6 space-y-2"><h2 className="text-xl font-semibold">Join lobby</h2><div className="flex gap-2"><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} className="flex-1 bg-slate-800 rounded-xl p-2 border border-slate-600 mono" placeholder="Enter code e.g. ANMT"/><button onClick={()=>nav('/'+joinCode.trim())} className="btn">Join</button></div></div>
    </div>
    <div id="rules" className="card p-6"><Rules/></div>
  </div>);
}
