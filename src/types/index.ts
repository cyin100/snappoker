
export type Suit = 'S'|'H'|'D'|'C';
export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14;
export type Card = { r: Rank, s: Suit };

export type Phase = 'FLOP'|'TURN'|'RIVER'|'SHOWDOWN';
export type Action = 'CHECK'|'SNAP'|'FOLD'|'ACCEPT';

export type PlayerState = {
  uid: string;
  nickname: string;
  lives: number;
  hole: Card[];
  snapUsed: boolean;
  ready?: boolean;
};

export type Community = {
  flop: Card[];
  turn?: Card;
  river?: Card;
};

export type LastAction = { byUid: string, action: Action, at: number } | null;
export type SnapPending = { byUid: string } | null;
export type FeedItem = { sys?: boolean, uid: string, nick: string, text: string, at: number };

export type PostRound = {
  state: 'FOLD'|'SHOWDOWN';
  winnerUid: string;
  loserUid: string;
  loss: number;
  show: Record<string, boolean | null>;
  deadlineAt?: number;
  revealAt?: number;
} | null;

export type GameDoc = {
  code: string;
  hostUid: string;
  playerA: PlayerState | null;
  playerB: PlayerState | null;
  pendingHoleB?: Card[];
  started: boolean;
  inPositionUid: string | null;
  toActUid: string | null;
  phase: Phase;
  stakes: number;
  snapPending: SnapPending;
  lastAction: LastAction;
  community: Community;
  deck: Card[];
  round: number;
  winnerUid: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  actedThisPhase?: string[];
  postRound?: PostRound;
  feed?: FeedItem[];
};
