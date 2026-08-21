#!/usr/bin/env node
// services.js の現在の内容から「マッチ条件・URL一覧」Excel（様式は既存の
// 確認中services-match-conditions-v2.xlsx を踏襲）を最新化する。
//
// 列7(マッチ条件・日本語)・列8(変更箇所) は人手で意味を確認して書いた文章なので、
// cond関数のソースコードが前回スナップショットと変わっていない行はそのまま
// 引き継ぎ、実際に意味が変わった行だけ JP_OVERRIDES で上書きする。
//
// 使い方: node scripts/export-match-conditions.js [出力ファイル名]

const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

const SRC_XLSX = '確認中services-match-conditions-v2 .xlsx';
const OUT_XLSX = process.argv[2] || SRC_XLSX;
const SHEET_NAME = 'マッチ条件・URL一覧';

const CAT_LABEL = {
  money: '給付・手当', child: '子育て', health: '医療・健康', elderly: '高齢者',
  welfare: '福祉', housing: '住まい', work: '就労', mental: '心の健康',
  emergency: '救急医療', disaster: '防災・備え', admin: '行政手続き',
};
const TARGET_LABEL = { child: '子ども', adult: '本人・大人', both: '両方' };

// 今回の一連の修正で cond の「意味」が変わった行だけ、JP訳・変更箇所を上書きする。
// （condのソース文字列は変わったがJP訳が既に新しい内容を反映済みの行は、
//   このリストに入れず既存のJP訳をそのまま引き継ぐ）
const JP_OVERRIDES = {
  16: {
    jp: '【本人が65歳以上】 または 【高齢者と同居している】',
    note: '',
  },
  74: {
    jp: '【子どもが15歳以下（小中学生相当）】で、【不登校・登校しぶり】または【子どもの教育・学校の困りごとがある】または【ひきこもり・不登校の困りごとがある】',
    note: '対象は小中学生限定だが、condに年齢条件がなく高校生や子ども未登録でもマッチしていたため、子どもの年齢15歳以下の条件を追加',
  },
  79: {
    jp: '【消費生活・詐欺被害の困りごとがある】 または 【本人が60歳以上】',
    note: '日本語欄に「本人が60歳以上」の記載が抜けていたため追加（condは元々age>=60を含んでいた。コード変更なし）',
  },
  23: {
    jp: '【身体障害等のある方がいる】 または 【知的障害のある方がいる】 または 【精神障害のある方がいる】 または 【障害がある状況】',
    note: '【必要書類】が各障害手帳で違うため、内容を反映する。／マッチ条件に【障害がある状況】(sit.disabled)を追加',
  },
  24: {
    jp: '【身体障害等のある方がいる】 または 【知的障害のある方がいる】 または 【精神障害のある方がいる】 または 【障害グレーゾーンの方がいる】 または 【障害がある状況】',
    note: 'マッチ条件に【障害がある状況】(sit.disabled)を追加',
  },
  37: {
    jp: '【ひきこもりの方がいる】 または 【障害グレーゾーンの方がいる】 または 【精神障害のある方がいる】 または 【心の健康・メンタルの困りごとがある】 または 【健康・医療の困りごとがある】 または 【ひきこもり状態】 または 【障害グレーゾーンの状況】 または 【障害がある状況】',
    note: '年齢を入力しただけで無関係な人にも表示されていたため、常時表示(|| true)を廃止し、関連タグ・困りごと選択時のみ表示するよう変更',
  },
  53: {
    jp: '【本人が60歳以上】',
    note: '同居高齢者の年齢によるマッチを削除し、本人年齢のみに限定',
  },
  69: {
    jp: '【ひきこもりの方がいる】 または 【ひきこもり・不登校の困りごとがある】 または 【子どもの教育・学校の困りごとがある】 または 【子どもの障害・発達の困りごとがある】 または 【不登校の子どもがいる】 または 【ひきこもり状態の成人家族(39歳以下)がいる】',
    note: '本人の年齢だけでのマッチを廃止し、ひきこもりタグを持つ成人家族(39歳以下)の登録を条件に変更',
  },
  77: {
    jp: '【身体障害のある方がいる】 または 【知的障害のある方がいる】 または 【障害グレーゾーンの方がいる】 または 【子どもの障害・発達の困りごとがある】 または 【特別支援が必要な子どもがいる】',
    note: 'マッチ条件に【身体障害のある方がいる】を追加',
  },
  81: {
    jp: '【本人が65歳以上】 または 【高齢者と同居している】 または 【身体障害のある方がいる】 または 【知的障害のある方がいる】 または 【精神障害のある方がいる】 または 【介護・高齢者の困りごとがある】',
    note: 'マッチ条件に【身体障害のある方がいる】を追加',
  },
  97: {
    jp: '【本人が20〜59歳】かつ（【就労状況=求職中・無職】 または 【就労状況=学生】 または 【所得=住民税非課税】 または 【所得=低所得】 または 【無職の状況】 または 【低所得の状況】 または 【お金・生活費の困りごとがある】）',
    note: '本人年齢が20〜59歳の場合のみマッチするよう年齢条件を追加（年齢不問での誤マッチを解消）',
  },
  103: {
    jp: '【就労状況=育休・産休中】 または 【妊娠中の状況】 または 【妊娠・出産の困りごとがある】 または 【子どもに2歳以下がいる】',
    note: '【子育て・保育の困りごとがある】単独でのマッチを削除（育児休業給付とは無関係な誤マッチを解消）',
  },
  134: {
    jp: '【ひきこもりの方がいる】または【ひきこもり・不登校の困りごとがある】または【ひきこもり状態の成人家族(15〜49歳)がいる】または（【本人の年齢が15〜49歳】かつ（【就労状況=求職中・無職】または【仕事・就労の困りごとがある】）)',
    note: 'マッチ条件に【ひきこもり状態の成人家族(15〜49歳)がいる】を追加',
  },
  135: {
    jp: '( 【本人が15〜49歳】 かつ ( 【就労状況=求職中・無職】 または 【仕事・就労の困りごとがある】 )) または 【ひきこもりの方がいる】 または 【ひきこもり状態の成人家族(15〜49歳)がいる】',
    note: 'マッチ条件に【ひきこもり状態の成人家族(15〜49歳)がいる】を追加',
  },
  136: {
    jp: '【税・国民年金の困りごとがある】 または 【障害のある方と同居している】 または 【障害がある状況】 または 【ひとり親（離婚・死別・未婚）】 または 【高齢者と同居している】',
    note: 'マッチ条件に【障害がある状況】(sit.disabled)を追加',
  },
  146: {
    jp: '【ひきこもりの方がいる】 または 【ひきこもり・不登校の困りごとがある】 または 【不登校の子どもがいる】 または 【ひきこもり状態の成人家族(15〜39歳)がいる】 または （【本人が15〜39歳】かつ（【就労状況=求職中・無職】または【仕事・就労の困りごとがある】）)',
    note: '本人年齢(15〜39歳)単独でのマッチを廃止し、就労状況・困りごととの組み合わせに変更。ひきこもり状態の成人家族(15〜39歳)の登録も条件に追加',
  },
  158: {
    jp: '【身体障害等のある方がいる】 または 【知的障害のある方がいる】 または 【精神障害のある方がいる】 または 【障害がある状況】',
    note: 'マッチ条件に【障害がある状況】(sit.disabled)を追加',
  },
  12: {
    // condは変更なし。その他リンク列だけ機械的に更新されるのでJP/変更箇所は不要だが、
    // 参考として変更箇所に記録しておく。
    keepJp: true,
    note: 'いきいき支援センター一覧（NAGOYAかいごネット）へのリンクを追加',
  },
};

function extraLinksCell(extraLinks) {
  if (!extraLinks || !extraLinks.length) return '';
  return extraLinks.map(l => `${l.label}: ${l.url}`).join('\n');
}

function condSource(fn) {
  return fn.toString().replace(/^\(s\)\s*=>\s*/, '').trim();
}

async function run() {
  const { SERVICES } = await import(path.join(__dirname, '../src/data/services.js'));

  const oldWb = XLSX.readFile(SRC_XLSX);
  const oldSheet = oldWb.Sheets[SHEET_NAME];
  const oldRows = XLSX.utils.sheet_to_json(oldSheet, { header: 1 }).slice(1);
  const oldById = new Map(oldRows.map(r => [r[0], r]));

  const header = ['ID', '項目名', 'カテゴリ', '対象', '緊急', 'グレーゾーン配慮', '概要',
    'マッチ条件（日本語）', '変更箇所', 'メインURL', 'メインURLラベル', '外部リンクURL',
    '外部リンクラベル', 'その他リンク(extraLinks)', 'マッチ条件(cond関数)'];

  const rows = [header];
  let updatedCount = 0;

  for (const s of SERVICES) {
    const old = oldById.get(s.id) || [];
    const override = JP_OVERRIDES[s.id];
    const jp = override && !override.keepJp ? override.jp : (old[7] ?? '');
    const note = override ? override.note : (old[8] ?? '');
    if (override) updatedCount++;

    rows.push([
      s.id,
      s.title,
      CAT_LABEL[s.cat] || s.cat,
      TARGET_LABEL[s.target] || s.target,
      s.urgent ? '○' : '',
      s.grayzone ? '○' : '',
      s.desc,
      jp,
      note,
      s.url || '',
      old[10] ?? '',
      old[11] ?? '',
      old[12] ?? '',
      extraLinksCell(s.extraLinks),
      condSource(s.cond),
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);

  // 「注意点」シートは既存のものをそのまま引き継ぐ
  if (oldWb.Sheets['注意点']) {
    XLSX.utils.book_append_sheet(wb, oldWb.Sheets['注意点'], '注意点');
  }

  XLSX.writeFile(wb, OUT_XLSX);
  console.log(`✅ 出力しました: ${OUT_XLSX}（全${SERVICES.length}件中、JP訳・変更箇所を更新: ${updatedCount}件）`);
}

run().catch(err => { console.error(err); process.exit(1); });
