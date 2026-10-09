import type { EnemyDef, Encounter } from '../core/types.ts';

export const ENEMIES: Record<string, EnemyDef> = {
  ytsoldier: {
    id: 'ytsoldier', name: '황건병', hp: 13,
    pattern: [{ kind: 'attack', row: 'front', dmg: 6, hits: 1 }, { kind: 'block', n: 5 }],
  },
  bandit: {
    id: 'bandit', name: '산적', hp: 18,
    pattern: [{ kind: 'attack', row: 'front', dmg: 8, hits: 1 }, { kind: 'attack', row: 'rear', dmg: 5, hits: 1 }],
  },
  archer: {
    id: 'archer', name: '궁수', hp: 11,
    pattern: [{ kind: 'attack', row: 'rear', dmg: 6, hits: 1 }, { kind: 'attack', row: 'front', dmg: 4, hits: 1 }],
  },
  pikeman: {
    id: 'pikeman', name: '창병', hp: 22,
    pattern: [{ kind: 'block', n: 7 }, { kind: 'attack', row: 'front', dmg: 9, hits: 1 }],
  },
  xlcav: {
    id: 'xlcav', name: '서량 기병', hp: 24,
    pattern: [{ kind: 'attack', row: 'rear', dmg: 10, hits: 1 }, { kind: 'attack', row: 'front', dmg: 8, hits: 1 }, { kind: 'buff', str: 2 }],
    trait: '후열을 노린다',
  },
  shield: {
    id: 'shield', name: '방패병', hp: 34,
    pattern: [{ kind: 'block', n: 10 }, { kind: 'attack', row: 'front', dmg: 7, hits: 1 }],
  },
  xbow: {
    id: 'xbow', name: '노병', hp: 16,
    pattern: [{ kind: 'attack', row: 'front', dmg: 4, hits: 2 }, { kind: 'attack', row: 'rear', dmg: 4, hits: 2 }],
  },
  sorcerer: {
    id: 'sorcerer', name: '황건 술사', hp: 28,
    pattern: [{ kind: 'buff', str: 2, allies: true }, { kind: 'attack', row: 'both', dmg: 4, hits: 1 }],
    trait: '아군 전원을 강화한다',
  },
  // 정예
  huaxiong: {
    id: 'huaxiong', name: '화웅', hp: 80,
    pattern: [
      { kind: 'attack', row: 'front', dmg: 13, hits: 1 },
      { kind: 'buff', str: 3, block: 8 },
      { kind: 'attack', row: 'rear', dmg: 11, hits: 1 },
    ],
    trait: '정예: 점점 강해진다',
  },
  zhangbao: {
    id: 'zhangbao', name: '장보', hp: 52,
    pattern: [
      { kind: 'cleanse', block: 8 },
      { kind: 'attack', row: 'both', dmg: 6, hits: 1 },
      { kind: 'buff', str: 2, allies: true },
    ],
    trait: '정예: 요술로 아군의 화상을 지우고 방비를 준다',
  },
  // 보스
  dongzhuo: {
    id: 'dongzhuo', name: '동탁', hp: 105, boss: true,
    pattern: [
      { kind: 'buff', str: 2, block: 8 },
      { kind: 'attack', row: 'front', dmg: 15, hits: 1 },
      { kind: 'summon', defId: 'guard', fallbackBlock: 10 },
      { kind: 'attack', row: 'both', dmg: 7, hits: 1 },
      { kind: 'attack', row: 'rear', dmg: 12, hits: 1 },
    ],
    phase2: {
      at: 0.5,
      str: 2,
      text: '폭정: 동탁이 분노하여 화상을 털어내고 힘 +2, 행동 양식이 바뀐다.',
      pattern: [
        { kind: 'attack', row: 'front', dmg: 14, hits: 1 },
        { kind: 'summon', defId: 'guard', fallbackBlock: 12 },
        { kind: 'attack', row: 'both', dmg: 8, hits: 1 },
        { kind: 'attack', row: 'rear', dmg: 5, hits: 3 },
      ],
    },
    trait: '보스: 쓰러지면 남은 적은 모두 도주한다. 체력 50% 이하가 되면 화상을 털어내고 2단계로.',
  },
  guard: {
    id: 'guard', name: '서량 친위병', hp: 20,
    pattern: [{ kind: 'attack', row: 'front', dmg: 6, hits: 1 }, { kind: 'block', n: 6 }],
  },
};

export const ENCOUNTERS: Record<string, Encounter> = {
  e_yt: { id: 'e_yt', name: '황건 잔당', enemies: ['ytsoldier', 'ytsoldier', 'ytsoldier'], tier: 'early' },
  e_bandit: { id: 'e_bandit', name: '산적 무리', enemies: ['bandit', 'bandit'], tier: 'early' },
  e_archers: { id: 'e_archers', name: '궁병대', enemies: ['archer', 'pikeman', 'archer'], tier: 'early' },
  e_cav: { id: 'e_cav', name: '서량 기병대', enemies: ['xlcav', 'xlcav'], tier: 'late' },
  e_shield: { id: 'e_shield', name: '방패 진영', enemies: ['xbow', 'shield', 'xbow'], tier: 'late' },
  e_sorc: { id: 'e_sorc', name: '황건 술사단', enemies: ['ytsoldier', 'sorcerer', 'ytsoldier'], tier: 'late' },
  el_huaxiong: { id: 'el_huaxiong', name: '맹장 화웅', enemies: ['huaxiong'], tier: 'elite' },
  el_zhangbao: { id: 'el_zhangbao', name: '요술사 장보', enemies: ['ytsoldier', 'zhangbao', 'ytsoldier'], tier: 'elite' },
  boss_dongzhuo: { id: 'boss_dongzhuo', name: '낙양의 동탁', enemies: ['dongzhuo', 'guard'], tier: 'boss' },
};
