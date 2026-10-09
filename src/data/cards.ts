import type { CardDef } from '../core/types.ts';

// 카드 설명문은 effects에서 자동 생성된다(core/describe.ts). 여기에는 효과 데이터만 둔다.
export const CARDS: Record<string, CardDef> = {};

function def(c: CardDef): void {
  CARDS[c.id] = c;
}

// ── 시작 카드 ──
def({ id: 'spear', name: '창격', cost: 1, family: 'mu', tags: [], target: 'enemy', rarity: 'starter', effects: [{ k: 'dmg', n: 6 }] });
def({ id: 'formation', name: '방진', cost: 1, family: 'bang', tags: [], target: 'row', rarity: 'starter', effects: [{ k: 'block', row: 'choose', n: 5 }] });
def({ id: 'order', name: '군령', cost: 1, family: 'chaek', tags: [], target: 'none', rarity: 'starter', synergy: ['cavalry'], effects: [{ k: 'draw', n: 2 }, { k: 'momentum', n: 1 }] });
def({ id: 'feint', name: '허보', cost: 0, family: 'chaek', tags: ['scheme'], target: 'enemy', rarity: 'starter', needsAttackIntent: true, effects: [{ k: 'swapIntentRow' }] });
def({ id: 'firearrow', name: '화시', cost: 1, family: 'chaek', tags: ['fire'], target: 'enemy', rarity: 'starter', effects: [{ k: 'dmg', n: 3 }, { k: 'burn', n: 3 }] });

// ── 일반 ──
def({ id: 'charge', name: '돌격', cost: 1, family: 'mu', tags: ['cavalry'], target: 'enemy', rarity: 'common', effects: [{ k: 'dmgMomentum', base: 4, per: 2 }] });
def({ id: 'volley', name: '연노', cost: 1, family: 'mu', tags: [], target: 'enemy', rarity: 'common', effects: [{ k: 'dmg', n: 3, hits: 2 }] });
def({ id: 'pursuit', name: '추격', cost: 0, family: 'mu', tags: ['cavalry'], target: 'enemy', rarity: 'common', synergy: ['fire'], effects: [{ k: 'dmgLowHpDouble', n: 3 }] });
def({ id: 'ram', name: '공성추', cost: 1, family: 'mu', tags: [], target: 'enemy', rarity: 'common', effects: [{ k: 'breakBlock' }, { k: 'dmg', n: 5 }] });
def({ id: 'wall', name: '견수', cost: 1, family: 'bang', tags: [], target: 'none', rarity: 'common', effects: [{ k: 'block', row: 'both', n: 4 }] });
def({ id: 'ambush', name: '매복', cost: 1, family: 'bang', tags: [], target: 'none', rarity: 'common', effects: [{ k: 'block', row: 'rear', n: 6 }, { k: 'counter', row: 'rear', n: 5 }] });
def({ id: 'readied', name: '반격 태세', cost: 1, family: 'bang', tags: [], target: 'none', rarity: 'common', effects: [{ k: 'block', row: 'front', n: 4 }, { k: 'counter', row: 'front', n: 4 }] });
def({ id: 'fireplan', name: '화계', cost: 2, family: 'chaek', tags: ['fire'], target: 'none', rarity: 'common', effects: [{ k: 'burnAll', n: 4 }] });
def({ id: 'requisition', name: '징발', cost: 0, family: 'chaek', tags: [], target: 'none', rarity: 'common', effects: [{ k: 'payFood', n: 1 }, { k: 'energy', n: 2 }] });
def({ id: 'bitter', name: '고육계', cost: 0, family: 'chaek', tags: [], target: 'none', rarity: 'common', effects: [{ k: 'loseHp', n: 4 }, { k: 'energy', n: 2 }, { k: 'draw', n: 1 }] });

// ── 희귀 ──
def({ id: 'ironcav', name: '철기 돌파', cost: 2, family: 'mu', tags: ['cavalry'], target: 'none', rarity: 'rare', effects: [{ k: 'dmgAll', n: 7 }] });
def({ id: 'duel', name: '일기토', cost: 2, family: 'mu', tags: [], target: 'enemy', rarity: 'rare', effects: [{ k: 'dmgMomentumDouble', n: 11, threshold: 3 }] });
def({ id: 'counterstrike', name: '역습', cost: 1, family: 'mu', tags: [], target: 'enemy', rarity: 'common', synergy: ['bang'], effects: [{ k: 'dmgBlock' }] });
def({ id: 'flank', name: '측면 기습', cost: 1, family: 'mu', tags: ['cavalry'], target: 'enemy', rarity: 'rare', effects: [{ k: 'dmg', n: 5 }, { k: 'draw', n: 1 }] });
def({ id: 'ironwall', name: '철벽', cost: 2, family: 'bang', tags: [], target: 'none', rarity: 'rare', effects: [{ k: 'block', row: 'front', n: 12 }] });
def({ id: 'hold', name: '수성', cost: 1, family: 'bang', tags: [], target: 'none', rarity: 'rare', effects: [{ k: 'blockDouble', cap: 15 }] });
def({ id: 'wind', name: '동남풍', cost: 1, family: 'chaek', tags: ['fire'], target: 'none', rarity: 'rare', exhaust: true, effects: [{ k: 'burnMultiply', cap: 8 }] });
def({ id: 'sulfur', name: '유황 투척', cost: 1, family: 'chaek', tags: ['fire'], target: 'enemy', rarity: 'rare', effects: [{ k: 'burn', n: 5 }] });
def({ id: 'sow', name: '이간계', cost: 1, family: 'chaek', tags: ['scheme'], target: 'enemy', rarity: 'rare', exhaust: true, needsAttackIntent: true, effects: [{ k: 'turncoat' }] });
def({ id: 'confuse', name: '교란', cost: 1, family: 'chaek', tags: ['scheme'], target: 'enemy', rarity: 'rare', exhaust: true, effects: [{ k: 'confuse' }] });

// ── 저주(사건으로만 획득) ──
def({ id: 'unrest', name: '민심 이반', cost: 0, family: 'chaek', tags: [], target: 'none', rarity: 'curse', unplayable: true, effects: [{ k: 'nothing' }], flavor: '징발의 대가. 손패 한 칸을 차지한다.' });
def({ id: 'rabble', name: '오합지졸', cost: 1, family: 'bang', tags: [], target: 'none', rarity: 'curse', exhaust: true, effects: [{ k: 'nothing' }], flavor: '훈련이 필요한 투항병. 지휘력 1로 정리할 수 있다.' });

export const REWARD_POOL = Object.values(CARDS).filter((c) => c.rarity === 'common' || c.rarity === 'rare' || c.id === 'order' || c.id === 'firearrow');

export const LORD_DECKS: Record<string, string[]> = {
  caocao: ['spear', 'spear', 'spear', 'spear', 'formation', 'formation', 'formation', 'readied', 'order', 'feint'],
  sunquan: ['spear', 'spear', 'spear', 'spear', 'formation', 'formation', 'formation', 'firearrow', 'firearrow', 'feint'],
};
