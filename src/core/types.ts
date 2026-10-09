// 게임 전반에서 쓰는 순수 데이터 타입. 화면(UI) 코드는 이 파일을 참조만 한다.

export type Row = 'front' | 'rear';
/** 전법 계열: 武(공격) · 防(방어) · 策(계책) */
export type Family = 'mu' | 'bang' | 'chaek';
export type Tag = 'cavalry' | 'fire' | 'scheme';
export type Affinity = Family | Tag;
export type Terrain = 'plains' | 'mountain' | 'river' | 'fortress';
export type Rarity = 'starter' | 'common' | 'rare' | 'curse';
export type Difficulty = 0 | 1;

// ───────────── 전법 카드 ─────────────

export type Effect =
  | { k: 'dmg'; n: number; hits?: number }
  | { k: 'dmgMomentum'; base: number; per: number }
  | { k: 'dmgAll'; n: number }
  | { k: 'dmgBlock' }
  | { k: 'dmgLowHpDouble'; n: number }
  | { k: 'dmgMomentumDouble'; n: number; threshold: number }
  | { k: 'breakBlock' }
  | { k: 'block'; row: 'choose' | 'front' | 'rear' | 'both'; n: number }
  | { k: 'blockDouble'; cap: number }
  | { k: 'counter'; row: Row; n: number }
  | { k: 'burn'; n: number }
  | { k: 'burnAll'; n: number }
  | { k: 'burnMultiply'; cap: number }
  | { k: 'draw'; n: number }
  | { k: 'energy'; n: number }
  | { k: 'momentum'; n: number }
  | { k: 'payFood'; n: number }
  | { k: 'loseHp'; n: number }
  | { k: 'swapIntentRow' }
  | { k: 'turncoat' }
  | { k: 'confuse' }
  | { k: 'nothing' };

export type CardTarget = 'enemy' | 'row' | 'none';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  family: Family;
  tags: Tag[];
  target: CardTarget;
  effects: Effect[];
  rarity: Rarity;
  exhaust?: boolean;
  unplayable?: boolean;
  /** 대상 적이 공격 의도를 가져야 하는 카드 */
  needsAttackIntent?: boolean;
  /** 계열·태그 외에 보상 편향에서 어울리는 장수 성향 */
  synergy?: Affinity[];
  flavor?: string;
}

export interface CardInst {
  uid: number;
  id: string;
}

// ───────────── 장수 ─────────────

export type RowReq = 'front' | 'rear' | 'any';

export interface GeneralDef {
  id: string;
  name: string;
  faction: string;
  role: string;
  row: RowReq;
  affinity: Affinity;
  ability: string;
  weakness: string;
  pairs: string;
  unlock?: boolean;
  starterOnly?: boolean;
  scholar?: boolean;
}

export interface GeneralInst {
  id: string;
  row: Row;
}

// ───────────── 적 ─────────────

export type Intent =
  | { kind: 'attack'; row: Row | 'both'; dmg: number; hits: number }
  | { kind: 'block'; n: number }
  | { kind: 'buff'; str: number; allies?: boolean; block?: number }
  | { kind: 'cleanse'; block: number }
  | { kind: 'summon'; defId: string; fallbackBlock: number };

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  pattern: Intent[];
  boss?: boolean;
  phase2?: { at: number; pattern: Intent[]; str: number; text: string };
  trait?: string;
}

export interface Encounter {
  id: string;
  name: string;
  enemies: string[];
  tier: 'early' | 'late' | 'elite' | 'boss';
}

export interface EnemyState {
  uid: number;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  str: number;
  burn: number;
  confused: boolean;
  turncoat: boolean;
  patternIdx: number;
  phase: 1 | 2;
  intent: Intent | null;
  dead: boolean;
}

// ───────────── 전투 ─────────────

export interface LogEntry {
  turn: number;
  text: string;
  kind: 'info' | 'player' | 'enemy' | 'general' | 'damage' | 'warn';
}

export interface BattleFlags {
  firstMuUsed: boolean;
  firstChaekDiscountUsed: boolean;
  freeSwapUsed: boolean;
  sunQuanUsed: boolean;
  drumUsed: boolean;
  zhangliaoUses: number;
  guojiaUsed: boolean;
  chengongBonus: number;
  familiesPlayed: Family[];
}

export interface BattleState {
  rng: number;
  turn: number;
  energy: number;
  baseEnergy: number;
  momentum: number;
  hp: number;
  maxHp: number;
  food: number;
  block: Record<Row, number>;
  counter: Record<Row, number>;
  /** 동요: 후열이 실제 피해를 받으면 다음 플레이어 턴 동안 후열 장수 능력 정지 */
  shakenRear: boolean;
  generals: GeneralInst[];
  enemies: EnemyState[];
  draw: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  exhausted: CardInst[];
  log: LogEntry[];
  terrain: Terrain;
  relics: string[];
  lordId: string;
  flags: BattleFlags;
  result: 'ongoing' | 'win' | 'lose';
  nextEnemyUid: number;
  /** 무한 연쇄 방지용 처리 예산 (턴마다 초기화) */
  budget: number;
  stats: { damageTaken: Record<string, number>; damageDealt: number; cardsPlayed: number; rowTaken: Record<Row, number> };
  encounterId: string;
  difficulty: number;
}

export interface PlayTarget {
  enemy?: number; // enemy uid
  row?: Row;
}

// ───────────── 원정 ─────────────

export type NodeType = 'battle' | 'elite' | 'recruit' | 'market' | 'rest' | 'supply' | 'event' | 'boss';

export interface MapNode {
  floor: number;
  col: number;
  type: NodeType;
  terrain: Terrain;
  next: number[]; // 다음 층에서 연결된 col 목록
  encounterId?: string;
  eventId?: string;
}

export type Pending =
  | { kind: 'none' }
  | { kind: 'reward'; food: number; cards: string[]; picked: boolean; extra?: { type: 'relic' | 'general'; options: string[]; picked: boolean } }
  | { kind: 'recruit'; options: string[] }
  | { kind: 'replaceGeneral'; incoming: string; then: Pending }
  | { kind: 'market'; cards: { id: string; price: number; sold: boolean }[]; relic: { id: string; price: number; sold: boolean } | null; removePrice: number; removed: boolean }
  | { kind: 'rest' }
  | { kind: 'supply' }
  | { kind: 'event'; eventId: string; resultText?: string }
  | { kind: 'deckPick'; mode: 'remove' | 'duplicate'; then: Pending; cost: number };

export type RunScreen = 'map' | 'battle' | 'node' | 'victory' | 'defeat';

export interface RunState {
  version: number;
  seed: number;
  rng: number;
  lordId: string;
  difficulty: Difficulty;
  unlocked: string[];
  hp: number;
  maxHp: number;
  food: number;
  deck: CardInst[];
  generals: GeneralInst[];
  relics: string[];
  map: MapNode[][];
  floor: number; // 현재 층(-1이면 출발 전)
  col: number;
  screen: RunScreen;
  pending: Pending;
  battle: BattleState | null;
  nextUid: number;
  flags: { allyBlessing: boolean; rewardPenalty: number };
  history: string[];
  lastBattleSummary: string[];
  defeatReason: string[];
}

export interface MetaState {
  version: number;
  runs: number;
  wins: number;
  unlockedGenerals: string[];
  difficultyUnlocked: Difficulty;
  seenGenerals: string[];
  bestFloor: number;
}
