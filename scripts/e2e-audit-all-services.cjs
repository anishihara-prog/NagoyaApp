#!/usr/bin/env node
// 全150件のサービスについて、それぞれのcond()を満たすプロフィールを1つ用意し、
// 実際にブラウザ（Expo web）を操作して検索結果画面のどこかにそのサービスが
// 表示されるかを確認する。「マッチ条件は満たしているのに画面に出ない」項目
// （ResultsScreen側の表示ロジックのバグ）を機械的に洗い出すための監査スクリプト。
//
// 使い方: node scripts/e2e-audit-all-services.cjs
// 前提: npx expo start --web --port 8081 --clear が起動していること

const { chromium } = require('playwright-core');
const path = require('path');
const { pathToFileURL } = require('url');

const BASE_URL = 'http://localhost:8081';

async function applyUiActions(page, uiActions) {
  const childCount = { n: 0 };
  const elderlyCount = { n: 0 };
  const adultCount = { n: 0 };

  for (const action of uiActions) {
    if (action.type === 'age') {
      await page.getByPlaceholder('例：13').fill(action.value);
    } else if (action.type === 'click') {
      await page.getByText(action.label, { exact: true }).first().click();
    } else if (action.type === 'addChild') {
      await page.getByText('子どもを追加', { exact: true }).click();
      await page.waitForTimeout(200);
      await page.locator('input[placeholder="歳"]').nth(childCount.n).fill(action.age);
      if (action.status) await page.getByText(action.status, { exact: true }).last().click();
      childCount.n++;
    } else if (action.type === 'addElderly') {
      await page.getByText('高齢者を追加', { exact: true }).click();
      await page.waitForTimeout(200);
      await page.locator('input[placeholder="歳"]').nth(elderlyCount.n).fill(action.age);
      if (action.relation) await page.getByText(action.relation, { exact: true }).last().click();
      if (action.careLevel) await page.getByText(action.careLevel, { exact: true }).last().click();
      elderlyCount.n++;
    } else if (action.type === 'addAdult') {
      await page.getByText('成人家族を追加', { exact: true }).click();
      await page.waitForTimeout(200);
      await page.locator('input[placeholder="歳"]').nth(adultCount.n).fill(action.age);
      if (action.relation) await page.getByText(action.relation, { exact: true }).last().click();
      if (action.tags) for (const t of action.tags) await page.getByText(t, { exact: true }).last().click();
      adultCount.n++;
    }
  }
}

async function main() {
  const servicesUrl = pathToFileURL(path.join(__dirname, '../src/data/services.js')).href;
  const candidatesUrl = pathToFileURL(path.join(__dirname, 'lib/candidate-profiles.mjs')).href;
  const { SERVICES } = await import(servicesUrl);
  const { assignCandidates } = await import(candidatesUrl);

  const candidateMap = assignCandidates(SERVICES);

  const browser = await chromium.launch();
  const results = [];

  const limit = process.env.AUDIT_LIMIT ? Number(process.env.AUDIT_LIMIT) : SERVICES.length;
  const onlyIds = process.env.AUDIT_IDS ? process.env.AUDIT_IDS.split(',').map(Number) : null;
  const targetServices = (onlyIds ? SERVICES.filter(s => onlyIds.includes(s.id)) : SERVICES).slice(0, limit);

  for (const s of targetServices) {
    const cand = candidateMap.get(s.id);
    if (!cand) {
      results.push({ id: s.id, title: s.title, status: 'NO_CANDIDATE' });
      continue;
    }
    const page = await browser.newPage({ viewport: { width: 430, height: 1400 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      await applyUiActions(page, cand.uiActions);
      await page.getByText('サービスを検索する', { exact: true }).click();
      await page.waitForTimeout(1500);
      const body = await page.locator('body').innerText();
      const found = body.includes(`[${s.id}]`);
      results.push({
        id: s.id, title: s.title, status: found ? 'OK' : 'MISSING',
        candidate: cand.desc, errors: errors.join(' / '),
      });
    } catch (e) {
      results.push({ id: s.id, title: s.title, status: 'ERROR', candidate: cand.desc, errors: e.message });
    }
    await page.close();
    process.stdout.write('.');
  }
  await browser.close();
  console.log('\n');

  const missing = results.filter(r => r.status === 'MISSING');
  const errored = results.filter(r => r.status === 'ERROR');
  const noCandidate = results.filter(r => r.status === 'NO_CANDIDATE');
  const ok = results.filter(r => r.status === 'OK');

  console.log('========================================');
  console.log(`OK: ${ok.length} / MISSING: ${missing.length} / ERROR: ${errored.length} / 候補なし: ${noCandidate.length} / 合計: ${results.length}`);
  console.log('========================================');

  if (missing.length) {
    console.log('\n--- マッチ条件は満たしているのに画面に表示されなかった項目 ---');
    for (const r of missing) {
      console.log(`[id ${r.id}] ${r.title}`);
      console.log(`  候補プロフィール: ${r.candidate}`);
    }
  }
  if (errored.length) {
    console.log('\n--- テスト実行中にエラーが発生した項目 ---');
    for (const r of errored) {
      console.log(`[id ${r.id}] ${r.title}: ${r.errors}`);
    }
  }
  if (noCandidate.length) {
    console.log('\n--- 自動テスト候補を用意できなかった項目 ---');
    for (const r of noCandidate) console.log(`[id ${r.id}] ${r.title}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
