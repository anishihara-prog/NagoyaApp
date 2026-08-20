// 過去に見つかったバグと同じパターンが他の項目にも潜んでいないか、
// services.js の cond 関数をソースコード文字列として機械的に走査する監査スクリプト。
// バグを1件直すたびに、その不具合の「形」をチェックとして1つ追加していく。
import { SERVICES } from '../src/data/services.js';

const checks = [];

// id51/54/77で発見: disabled/intellectual/mental の一部だけ参照していて、
// 意図せず特定の障害種別だけ抜け落ちているケース
checks.push({
  name: '障害タグ(身体/知的/精神)の一部だけ参照している項目',
  run(services) {
    const findings = [];
    for (const s of services) {
      const src = s.cond.toString();
      const hasDisabled = src.includes("'disabled'");
      const hasIntellectual = src.includes("'intellectual'");
      const hasMental = src.includes("'mental'");
      const hasAny = hasDisabled || hasIntellectual || hasMental;
      if (hasAny && !(hasDisabled && hasIntellectual && hasMental)) {
        const missing = [];
        if (!hasDisabled) missing.push('身体(disabled)');
        if (!hasIntellectual) missing.push('知的(intellectual)');
        if (!hasMental) missing.push('精神(mental)');
        findings.push({ id: s.id, title: s.title, detail: `欠けているタグ: ${missing.join(' / ')}`, cond: src });
      }
    }
    return findings;
  },
});

// disabledMembers を直接参照しているが、sit/concerns 経由のフォールバックが一切ない項目
// (employment='disabled_work' など、タグ以外の入力経路から来た障害者が拾われない可能性)
checks.push({
  name: 'disabledMembersのみ参照でsit/concernsのフォールバックがない項目',
  run(services) {
    const findings = [];
    for (const s of services) {
      const src = s.cond.toString();
      if (!src.includes('disabledMembers')) continue;
      const hasSitFallback = ['disabled', 'elderly', 'hikikomori', 'gray'].some(v => src.includes(`sit?.includes('${v}')`));
      const hasConcernFallback = ['disability_service', 'mental_health', 'child_disability', 'hikikomori_concern', 'nursing'].some(v => src.includes(`concerns?.includes('${v}')`));
      if (!hasSitFallback && !hasConcernFallback) {
        findings.push({ id: s.id, title: s.title, cond: src });
      }
    }
    return findings;
  },
});

let totalFindings = 0;
console.log(`SERVICES: ${SERVICES.length}件\n`);
for (const check of checks) {
  console.log('='.repeat(70));
  console.log(check.name);
  console.log('='.repeat(70));
  const findings = check.run(SERVICES);
  totalFindings += findings.length;
  if (findings.length === 0) {
    console.log('該当なし\n');
    continue;
  }
  for (const f of findings) {
    console.log(`\n[id ${f.id}] ${f.title}`);
    if (f.detail) console.log(`  ${f.detail}`);
    console.log(`  cond: ${f.cond}`);
  }
  console.log('');
}
console.log(`合計 ${totalFindings} 件検出（人手での要確認・誤検知を含む）`);
