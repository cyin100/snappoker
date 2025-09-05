
import type { GameDoc } from '@/types';
export function shortCode(n=4){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<n;i++) s+=alphabet[Math.floor(Math.random()*alphabet.length)]; return s;}
export function copyToClipboard(text:string){navigator.clipboard?.writeText(text).catch(()=>{});}
export function stakesEmoji(stakes:number){ if(stakes>=8) return '😱'; if(stakes>=4) return '😨'; if(stakes>=2) return '😮'; return '☺️'; }
export function stakesCap(g:GameDoc){const a=g.playerA?.lives??0, b=g.playerB?.lives??0; return Math.max(1, Math.min(a,b));}
