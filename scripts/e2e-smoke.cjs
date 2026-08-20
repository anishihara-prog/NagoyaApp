#!/usr/bin/env node
// E2Eスモークテスト（Playwrightで実ブラウザを操作）
//
// 使い方:
//   1. 別ターミナルで `npx expo start --web --port 8081 --clear` を起動しておく
//   2. `node scripts/e2e-smoke.cjs` を実行
//
// このコンテナには chromium-cli がないため playwright-core を直接使う（CLAUDE.md参照）。
// playwright-core は package.json に追加せず、グローバルインストール（npm root -g）から解決する。
//
// Profile→Results→Detail→Chat→Disaster の主要5画面を実際に操作し、
// ページ例外・コンソールエラーの有無と、主要な表示内容を検証する。
// 失敗があれば非ゼロで終了する（CIやスクリプトからの自動判定に使える）。

const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try {
    return require('playwright-core');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright-core'));
  }
}

const { chromium } = loadPlaywright();
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8081';

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`);
}

async function withPage(browser, fn) {
  const page = await browser.newPage({ viewport: { width: 430, height: 1200 } });
  const errors = [];
  page.on('pageerror', err => errors.push('PAGE EXCEPTION: ' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text()); });
  await fn(page, errors);
  await page.close();
  return errors;
}

async function main() {
  const browser = await chromium.launch();

  // ── 1. Profile画面の初期表示（ドラフト自動復元機能を削除済み：空欄であること） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    const ageValue = await page.getByPlaceholder('例：13').inputValue();
    record('Profile画面が空欄で起動する', ageValue === '', `age入力値="${ageValue}"`);
    record('Profile画面ロード時にエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 2. 高齢者家族登録ケース：本人向け/高齢者向けが分離表示されること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByText('中区', { exact: true }).click();
    await page.getByPlaceholder('例：13').fill('40');
    await page.getByText('男性', { exact: true }).click();
    await page.getByText('既婚', { exact: true }).click();
    await page.getByText('家族と同居', { exact: true }).click();
    await page.getByText('高齢者を追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('68');
    await page.getByText('親', { exact: true }).click();
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const headings = await page.locator('text=/向けサービス/').allInnerTexts();
    record('本人向けサービスの見出しがある', headings.includes('本人向けサービス'), headings.join(' / '));
    record('親（68歳）向けサービスの見出しがある（高齢者家族が本人と分離表示）', headings.includes('親（68歳）向けサービス'), headings.join(' / '));

    // Detail画面への遷移と復帰
    await page.getByText('詳細を見る', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    const detailText = await page.locator('body').innerText();
    record('Detail画面に「サービス詳細」が表示される', detailText.includes('サービス詳細'));
    await page.mouse.click(18, 20); // ヘッダー左上の戻る矢印（role=buttonが付与されないため座標クリック）
    await page.waitForTimeout(1000);
    const backText = await page.locator('body').innerText();
    record('戻るとResults画面に復帰する', backText.includes('おすすめサービス'));

    // Chat画面
    await page.getByText('チャットで詳しく調べる', { exact: true }).click();
    await page.waitForTimeout(1500);
    const chatText = await page.locator('body').innerText();
    record('Chat画面にプロフィール反映済みの挨拶が出る', chatText.includes('40歳') && chatText.includes('こんにちは'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 3. 子ども複数人ケース：子ども1人ごとにラベル付き見出しが出ること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('38');
    await page.getByText('離婚・別居', { exact: true }).click();
    await page.getByText('子どもを追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('子どもを追加', { exact: true }).click();
    await page.waitForTimeout(300);
    const childAgeInputs = page.locator('input[placeholder="歳"]');
    await childAgeInputs.nth(0).fill('6');
    await childAgeInputs.nth(1).fill('15');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const headings = await page.locator('text=/向けサービス/').allInnerTexts();
    record('1人目のお子さま（6歳）向けサービスの見出しがある', headings.includes('1人目のお子さま（6歳）向けサービス'), headings.join(' / '));
    record('2人目のお子さま（15歳）向けサービスの見出しがある（きょうだいで別見出し）', headings.includes('2人目のお子さま（15歳）向けサービス'), headings.join(' / '));

    // 人ごとに見るモードも確認
    await page.getByText('人ごとに見る', { exact: true }).click();
    await page.waitForTimeout(1000);
    const byPersonText = await page.locator('body').innerText();
    record('人ごとに見るモードで本人・子ども別々のタブが出る', byPersonText.includes('本人') && byPersonText.includes('1人目のお子さま'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 4. 成人家族登録：続柄（年齢）向けの見出しと、年齢連動サービスが正しく出ること ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('50');
    await page.getByText('既婚', { exact: true }).click();
    await page.getByText('家族と同居', { exact: true }).click();
    await page.getByText('成人家族を追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('30');
    await page.getByText('兄弟姉妹', { exact: true }).click();
    await page.getByText('ひきこもり・\n不登校', { exact: true }).first().click();
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const headings = await page.locator('text=/向けサービス/').allInnerTexts();
    record('兄弟姉妹（30歳）向けサービスの見出しがある（成人家族が本人と分離表示）', headings.includes('兄弟姉妹（30歳）向けサービス'), headings.join(' / '));

    const body = await page.locator('body').innerText();
    const selfBlockStart = body.indexOf('本人向けサービス');
    const adultBlockStart = body.indexOf('兄弟姉妹（30歳）向けサービス');
    const selfBlockText = body.slice(selfBlockStart, adultBlockStart > selfBlockStart ? adultBlockStart : body.length);
    const adultBlockText = body.slice(adultBlockStart);
    record('ひきこもり状態の成人家族（15〜49歳）向けになごや若者サポートステーションが出る', adultBlockText.includes('なごや若者サポートステーション'));
    record('本人向けサービスに成人家族のひきこもり情報が漏れていない（過去バグの回帰確認）', !selfBlockText.includes('なごや若者サポートステーション') && !selfBlockText.includes('まえジョブ'));
    record('本人（50歳）に本来関係ある特定健康診査が消えていない（成人家族登録による過剰除外の回帰確認）', selfBlockText.includes('特定健康診査'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5. 本人の障害タグが、タグなしの成人家族に誤って波及しないこと（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('55');
    await page.getByText('既婚', { exact: true }).click();
    await page.getByText('家族と同居', { exact: true }).click();
    await page.getByText('身体障害（手帳あり）', { exact: true }).click();
    await page.getByText('成人家族を追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('28');
    await page.getByText('成人の子', { exact: true }).click();
    // タグは選択しない
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    const selfBlockStart = body.indexOf('本人向けサービス');
    const adultBlockStart = body.indexOf('成人の子（28歳）向けサービス');
    const selfBlockText = body.slice(selfBlockStart, adultBlockStart > selfBlockStart ? adultBlockStart : body.length);
    const adultBlockText = adultBlockStart >= 0 ? body.slice(adultBlockStart) : '';

    record('障害タグありの本人には障害者向け交通料金等の軽減が出る', selfBlockText.includes('障害者向け交通料金等の軽減'));
    record('障害タグありの本人には所得控除が出る', selfBlockText.includes('所得控除'));
    record('障害タグありの本人には障害者基幹相談支援センターが出る', selfBlockText.includes('障害者基幹相談支援センター'));
    record('障害タグなしの成人家族には障害者向け交通料金等の軽減が出ない（本人のタグが誤って波及しない）', !adultBlockText.includes('障害者向け交通料金等の軽減'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5b. 「ひきこもり」タグのみ（手帳不要）の成人家族に、手帳前提の交通料金軽減が出ないこと（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('55');
    await page.getByText('既婚', { exact: true }).click();
    await page.getByText('家族と同居', { exact: true }).click();
    await page.getByText('成人家族を追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('28');
    await page.getByText('成人の子', { exact: true }).click();
    await page.getByText('ひきこもり・\n不登校', { exact: true }).first().click();
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    const adultBlockStart = body.indexOf('成人の子（28歳）向けサービス');
    const adultBlockText = adultBlockStart >= 0 ? body.slice(adultBlockStart) : '';
    record('「ひきこもり」タグのみの成人家族には障害者向け交通料金等の軽減が出ない（手帳系タグと無関係な波及の回帰確認）', !adultBlockText.includes('障害者向け交通料金等の軽減'));
    record('「ひきこもり」タグのみの成人家族には粗大ごみ・家庭ごみの収集案内が出ない（手帳系タグと無関係な波及の回帰確認）', !adultBlockText.includes('粗大ごみ・家庭ごみの収集・分別案内'));
    record('「ひきこもり」タグのみの成人家族には所得控除が出ない（手帳系タグと無関係な波及の回帰確認）', !adultBlockText.includes('所得控除'));
    record('「ひきこもり」タグのみの成人家族には障害者基幹相談支援センターが出ない（手帳系タグと無関係な波及の回帰確認）', !adultBlockText.includes('障害者基幹相談支援センター'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5c. 本人の「交通・移動のこと」困りごとが、タグなしの成人家族に誤って波及しないこと（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('55');
    await page.getByText('既婚', { exact: true }).click();
    await page.getByText('家族と同居', { exact: true }).click();
    await page.getByText('交通・移動のこと', { exact: true }).click();
    await page.getByText('成人家族を追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('28');
    await page.getByText('成人の子', { exact: true }).click();
    // タグは選択しない
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    const adultBlockStart = body.indexOf('成人の子（28歳）向けサービス');
    const adultBlockText = adultBlockStart >= 0 ? body.slice(adultBlockStart) : '';
    record('本人の「交通・移動のこと」困りごとが、タグなしの成人家族に波及しない（concerns漏れの回帰確認）', !adultBlockText.includes('障害者向け交通料金等の軽減'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5d. 20歳・女性・困りごと未選択で、ひきこもり関連サービスが年齢だけで出ないこと（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('20');
    await page.getByText('女性', { exact: true }).click();
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    record('20歳・女性・困りごとなしで若者自立支援ステップアップ事業が出ない（年齢だけでの誤マッチの回帰確認）', !body.includes('若者自立支援ステップアップ事業'));
    record('20歳・女性・困りごとなしで子ども・若者総合相談センターが出ない（年齢だけでの誤マッチの回帰確認）', !body.includes('子ども・若者総合相談センター'));
    record('ここらぼのカードに組織名が二重に出ない（title/contact重複の回帰確認）', (body.match(/名古屋市精神保健福祉センターここらぼ/g) || []).length <= 1);

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5e. 就労状況「障害等で未就労」を選ぶと障害福祉関連サービスが出ること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('35');
    await page.getByText('障害等で未就労', { exact: true }).click();
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    record('「障害等で未就労」を選ぶと障害者向け交通料金等の軽減が出る', body.includes('障害者向け交通料金等の軽減'));
    record('「障害等で未就労」を選ぶと障害者基幹相談支援センターが出る', body.includes('障害者基幹相談支援センター'));
    record('「障害等で未就労」を選ぶと所得控除が出る', body.includes('所得控除'));
    record('「障害等で未就労」を選ぶと障害者手帳（身体・療育・精神）が出る', body.includes('障害者手帳（身体・療育・精神）'));
    record('「障害等で未就労」を選ぶと障害福祉サービス（居宅介護・就労支援等）が出る', body.includes('障害福祉サービス（居宅介護・就労支援等）'));
    record('「障害等で未就労」を選ぶと障害者医療費助成制度が出る', body.includes('障害者医療費助成制度'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5f0. ここらぼが「困りごと」未選択では出ず、「心の健康・メンタルのこと」選択時のみ出ること（常時表示仕様の廃止確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('30');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);
    const bodyWithoutConcern = await page.locator('body').innerText();
    record('困りごと未選択ではここらぼが出ない（常時表示仕様の廃止確認）', !bodyWithoutConcern.includes('ここらぼ'));

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.getByPlaceholder('例：13').fill('30');
    await page.getByText('心の健康・メンタルのこと', { exact: true }).click();
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);
    const bodyWithConcern = await page.locator('body').innerText();
    record('「心の健康・メンタルのこと」選択でここらぼが出る', bodyWithConcern.includes('ここらぼ'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5f. 知的障害タグ＋高齢者家族登録で、なごやか収集・障害者権利擁護センターが出ること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('30');
    await page.getByText('知的障害（療育手帳）', { exact: true }).click();
    await page.getByText('高齢者を追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('70');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    record('知的障害タグ＋高齢者家族登録でなごやか収集が出る', body.includes('なごやか収集'));
    record('知的障害タグ＋高齢者家族登録で障害者・高齢者権利擁護センターが出る', body.includes('障害者・高齢者権利擁護センター'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5g. 知的障害タグ＋子ども登録で、名古屋市中央療育センターが出ること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('35');
    await page.getByText('知的障害（療育手帳）', { exact: true }).click();
    await page.getByText('子どもを追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('5');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    record('知的障害タグ＋子ども登録で名古屋市中央療育センターが出る', body.includes('名古屋市中央療育センター'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5h. 本人が16歳（子ども未登録）で、target:'child'だが本人年齢条件も持つ項目
  //        （高校生等就学支援金など）が本人向けサービスに出ること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('16');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    record('本人16歳（子ども未登録）で本人向けサービスの見出しが出る', body.includes('本人向けサービス'));
    record('本人16歳（子ども未登録）で高等学校等就学支援金（国）が本人向けに出る', body.includes('高等学校等就学支援金（国）'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 5i. 本人40歳＋子ども16歳登録で、高校生等就学支援金が本人向けと子ども向けに二重表示されないこと（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByPlaceholder('例：13').fill('40');
    await page.getByText('子どもを追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('16');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').innerText();
    const selfBlockStart = body.indexOf('本人向けサービス');
    const childBlockStart = body.indexOf('向けサービス', selfBlockStart + 5);
    const selfBlockText = body.slice(selfBlockStart, childBlockStart > selfBlockStart ? childBlockStart : body.length);
    record('本人40歳＋子ども16歳登録で、高校生等就学支援金が本人向けに漏れていない（子ども向けのみに表示）', !selfBlockText.includes('高等学校等就学支援金'));
    record('本人40歳＋子ども16歳登録で、子ども向けサービスに高校生等就学支援金が出る', body.includes('高等学校等就学支援金（国）'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 6. 防災情報：乳幼児（0〜5歳）がいる世帯で要配慮者カードが出ること（過去バグの回帰確認） ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByText('中区', { exact: true }).click();
    await page.getByPlaceholder('例：13').fill('32');
    await page.getByText('子どもを追加', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="歳"]').first().fill('3');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByText('人ごとに見る', { exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByText('防災情報', { exact: true }).click();
    await page.waitForTimeout(1000);

    const text = await page.locator('body').innerText();
    record('3歳の子がいる世帯で「要配慮者の方がいる世帯への注意」が表示される', text.includes('要配慮者の方がいる世帯への注意'));
    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  // ── 7. 異常系入力：年齢未入力・極端な値でもクラッシュしないこと ──
  await withPage(browser, async (page, errors) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(1500);
    const text1 = await page.locator('body').innerText();
    record('年齢未入力で検索してもクラッシュしない', text1.includes('おすすめサービス'));

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.getByPlaceholder('例：13').fill('999');
    await page.getByText('サービスを検索する', { exact: true }).click();
    await page.waitForTimeout(1500);
    const text2 = await page.locator('body').innerText();
    record('年齢999（異常値）で検索してもクラッシュしない', text2.includes('おすすめサービス'));

    record('この一連の操作でエラーなし', errors.length === 0, errors.join(' / '));
  });

  await browser.close();

  console.log('\n========================================');
  const failed = results.filter(r => !r.pass);
  console.log(`結果: ${results.length - failed.length}/${results.length} 件PASS`);
  if (failed.length > 0) {
    console.log('\nFAILしたチェック:');
    failed.forEach(f => console.log(`  - ${f.name}${f.detail ? ' (' + f.detail + ')' : ''}`));
    process.exit(1);
  }
}

main().catch(e => { console.error('E2Eスクリプト自体が失敗:', e); process.exit(1); });
