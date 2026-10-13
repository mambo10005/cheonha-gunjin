/** 플레이테스트 표시 검증(순환 import 방지를 위해 분리). */
export function validPlaytestFlag(v:unknown):boolean{return v===undefined||(!!v&&typeof v==='object'&&(v as any).version===1&&typeof (v as any).preset==='string'&&(v as any).preset.length<=40&&Number.isFinite((v as any).startedAt));}
