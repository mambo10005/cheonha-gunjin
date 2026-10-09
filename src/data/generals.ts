import type { GeneralDef } from '../core/types.ts';

// 장수 능력의 실제 처리는 core/combat.ts의 장수 훅에 있다. ability 문구와 처리 코드를 함께 수정할 것.
// 역사 인물의 성격은 게임적 해석이며 사실 고증이 아니다.
export const GENERALS: Record<string, GeneralDef> = {
  dianwei: {
    id: 'dianwei', name: '전위', faction: '위', role: '호위·반격', row: 'front', affinity: 'bang',
    ability: '전열에서: 적이 전열을 공격할 때마다 공격자에게 반격 3 + (공격을 막고 남은 전열 방비의 절반).',
    weakness: '전열이 공격받지 않으면 아무 일도 하지 않는다. 방비를 쌓지 않으면 반격이 약하다.',
    pairs: '반격 태세, 학소, 조인', starterOnly: true,
  },
  chengpu: {
    id: 'chengpu', name: '정보', faction: '오', role: '노장·화공 마무리', row: 'front', affinity: 'fire',
    ability: '전열에서: 화상 상태인 적에게 주는 카드 피해 +2.',
    weakness: '화상을 걸지 못하면 평범하다.',
    pairs: '화시, 연노, 황개', starterOnly: true,
  },
  caoren: {
    id: 'caoren', name: '조인', faction: '위', role: '방비 유지', row: 'front', affinity: 'bang',
    ability: '전열에서: 내 턴이 시작될 때 남은 전열 방비가 사라지지 않고 절반(내림)이 유지된다.',
    weakness: '방비 카드가 적으면 효과가 작다. 공격력은 없다.',
    pairs: '철벽, 수성, 역습',
  },
  haozhao: {
    id: 'haozhao', name: '학소', faction: '위', role: '성채 수비·반격 보강', row: 'any', affinity: 'bang',
    ability: '어디서나: 전투 시작 시 전열 방비 6(성채 지형 12). 반격이 발생할 때마다 전열 방비 +2.',
    weakness: '반격 수단이 없으면 시작 방비 외에는 쓸모가 적다.',
    pairs: '전위, 반격 태세, 매복',
  },
  huanggai: {
    id: 'huanggai', name: '황개', faction: '오', role: '고육계·화공 증폭', row: 'front', affinity: 'fire',
    ability: '전열에서: 화공 카드를 쓸 때마다 병력 2를 잃고, 체력이 가장 높은 적에게 화상 3.',
    weakness: '병력을 계속 깎는다. 긴 원정에서 위험하다.',
    pairs: '화계, 유황 투척, 방통',
  },
  luxun: {
    id: 'luxun', name: '육손', faction: '오', role: '연소 확산', row: 'rear', affinity: 'fire', scholar: true,
    ability: '후열에서: 적이 쓰러지면 그 적에게 남은 화상을 살아있는 다른 적 전원에게 옮긴다.',
    weakness: '적이 하나뿐이면 효과가 없다.',
    pairs: '화계, 동남풍, 추격',
  },
  pangtong: {
    id: 'pangtong', name: '방통', faction: '촉', role: '연환·화상 증폭', row: 'rear', affinity: 'fire', scholar: true,
    ability: '후열에서: 살아있는 적 전원이 화상 상태면 화상 피해가 2배.',
    weakness: '한 명이라도 화상이 없으면 무력하다.',
    pairs: '화계, 육손, 동남풍',
  },
  lubu: {
    id: 'lubu', name: '여포', faction: '군웅', role: '폭발적 돌파', row: 'front', affinity: 'cavalry',
    ability: '전열에서: 이번 턴 3번째 이후로 사용한 武 카드의 피해를 한 번 더 발동. 턴 종료 시 기세가 3 미만이면 병력 3을 잃는다(불만).',
    weakness: '카드를 적게 쓰는 턴마다 병력을 잃는다.',
    pairs: '군령, 추격, 징발, 장료',
  },
  zhangliao: {
    id: 'zhangliao', name: '장료', faction: '위', role: '기병 연쇄', row: 'any', affinity: 'cavalry',
    ability: '어디서나: 기병 카드로 적을 쓰러뜨리면 지휘력 +1, 카드 1장 뽑기(턴당 2회).',
    weakness: '마무리할 적이 없으면 효과가 없다.',
    pairs: '추격, 철기 돌파, 여포',
  },
  guojia: {
    id: 'guojia', name: '곽가', faction: '위', role: '의도 조작', row: 'rear', affinity: 'scheme', scholar: true,
    ability: '후열에서: 계책(허보·이간계·교란) 카드를 쓰면 지휘력 +1, 카드 1장 뽑기(턴당 1회).',
    weakness: '계책 카드가 없으면 빈자리다. 후열 피해에 약하다.',
    pairs: '허보, 이간계, 진궁',
  },
  chengong: {
    id: 'chengong', name: '진궁', faction: '군웅', role: '계책→공격 연계', row: 'rear', affinity: 'scheme', scholar: true, unlock: true,
    ability: '후열에서: 策 카드를 쓸 때마다 이번 턴 다음 武 카드 피해 +4(최대 +12).',
    weakness: '武 카드와 策 카드를 둘 다 들고 있어야 한다.',
    pairs: '군령, 허보, 일기토',
  },
  machao: {
    id: 'machao', name: '마초', faction: '군웅', role: '선봉 기세', row: 'front', affinity: 'cavalry', unlock: true,
    ability: '전열에서: 기병 카드를 쓰면 기세 +1 추가. 전투 첫 턴 지휘력 +1.',
    weakness: '기병 카드가 없으면 첫 턴 보너스뿐이다.',
    pairs: '돌격, 일기토, 여포',
  },
};

export const MAX_GENERALS = 4;
export const ROW_CAPACITY = 2;
