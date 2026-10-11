// 데이터 → 한국어 설명문. 카드 문구를 손으로 쓰지 않고 효과 데이터에서 생성해
// "설명과 실제 효과가 어긋나는" 문제를 구조적으로 막는다.
import type { CardDef, Effect, Family, Intent, Row, Tag } from './types.ts';

export const FAMILY_NAME: Record<Family, string> = { mu: '공격', bang: '방어', chaek: '계책' };
export const FAMILY_LABEL: Record<Family, string> = { mu: '공격', bang: '방어', chaek: '계책' };
export const TAG_NAME: Record<Tag, string> = { cavalry: '기병', fire: '화공', scheme: '계책' };
export const ROW_NAME: Record<Row, string> = { front: '전열', rear: '후열' };

export function describeEffect(e: Effect): string {
  switch (e.k) {
    case 'dmg':
      return e.hits && e.hits > 1 ? `피해 ${e.n}을 ${e.hits}회` : `피해 ${e.n}`;
    case 'dmgMomentum':
      return `피해 ${e.base} + 기세×${e.per}`;
    case 'dmgAll':
      return `적 전원에게 피해 ${e.n}`;
    case 'dmgBlock':
      return '현재 전열 방비만큼 피해';
    case 'dmgLowHpDouble':
      return `피해 ${e.n}. 대상 체력이 절반 이하면 2배`;
    case 'dmgMomentumDouble':
      return `피해 ${e.n}. 기세 ${e.threshold} 이상이면 2배`;
    case 'breakBlock':
      return '대상의 방비를 모두 제거';
    case 'block':
      if (e.row === 'choose') return `선택한 열에 방비 ${e.n}`;
      if (e.row === 'both') return `전열·후열에 방비 각 ${e.n}`;
      return `${ROW_NAME[e.row]} 방비 ${e.n}`;
    case 'blockDouble':
      return `전열 방비를 2배로 (최대 +${e.cap})`;
    case 'counter':
      return `이번 적 턴에 ${ROW_NAME[e.row]}이 공격받으면 공격자에게 반격 ${e.n}`;
    case 'burn':
      return `화상 ${e.n}`;
    case 'burnAll':
      return `적 전원에게 화상 ${e.n}`;
    case 'burnMultiply':
      return `적 전원의 화상을 2배로 (적마다 최대 +${e.cap})`;
    case 'draw':
      return `카드 ${e.n}장 뽑기`;
    case 'energy':
      return `지휘력 +${e.n}`;
    case 'momentum':
      return `기세 +${e.n}`;
    case 'payFood':
      return `군량 ${e.n} 소비(없으면 사용 불가)`;
    case 'loseHp':
      return `병력 ${e.n} 잃음`;
    case 'swapIntentRow':
      return '공격 의도의 대상 열을 전열↔후열로 바꿈';
    case 'turncoat':
      return '대상의 다음 공격이 체력이 가장 높은 다른 적을 향함(다른 적이 없으면 원래대로)';
    case 'confuse':
      return '대상의 다음 행동 취소';
    case 'nothing':
      return '효과 없음';
  }
}

export function describeCard(c: CardDef): string {
  const parts = c.effects.map(describeEffect);
  let text = parts.join('. ');
  if (c.unplayable) text = '사용 불가.';
  if (c.exhaust) text += '. 소멸';
  if (c.flavor && c.rarity === 'curse') text += ` — ${c.flavor}`;
  return text;
}

export function intentText(i: Intent | null, str = 0): string {
  if (!i) return '—';
  switch (i.kind) {
    case 'attack': {
      const target = i.row === 'both' ? '전열·후열' : ROW_NAME[i.row];
      const dmg = i.dmg + str;
      return i.hits > 1 ? `${target} 공격 ${dmg}×${i.hits}` : `${target} 공격 ${dmg}`;
    }
    case 'block':
      return `방비 ${i.n}`;
    case 'buff':
      return `${i.allies ? '아군 전원 ' : ''}힘 +${i.str}${i.block ? ` · 방비 ${i.block}` : ''}`;
    case 'cleanse':
      return `요술: 아군 화상 제거 · 방비 ${i.block}`;
    case 'summon':
      return `증원 호출 (아군 2명 이상이면 방비 ${i.fallbackBlock})`;
  }
}
