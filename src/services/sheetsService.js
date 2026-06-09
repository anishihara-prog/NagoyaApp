// Google Sheets からサービスデータを CSV で取得してパースするサービス
// スプレッドシートを「リンクを知っている全員が閲覧可能」に設定する必要があります

const SHEET_ID = '1LYNAvtLn0kORJpjWuwMYk1YbZr7BEP1flraZFB_6C6M';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

// RFC 4180 準拠のシンプルな CSV パーサー
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        // エスケープされた引用符 ""
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r' && next === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else if (char === '\n' || char === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else {
        field += char;
      }
    }
  }

  // 最後の行
  if (row.length > 0 || field !== '') {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// スプレッドシートのヘッダー（1行目）から各フィールドを対応付け
// 期待するヘッダー: id, title, cat, urgent, target, grayzone, welnet, desc, detail, url, contact
function rowsToServices(rows) {
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return rows
    .slice(1)
    .filter(row => row.some(cell => cell.trim() !== '')) // 空行をスキップ
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] ?? '').trim();
      });

      const id = parseInt(obj.id);
      if (!id || !obj.title) return null;

      return {
        id,
        title:    obj.title,
        cat:      obj.cat || 'welfare',
        urgent:   obj.urgent?.toLowerCase() === 'true',
        target:   obj.target || 'both',
        grayzone: obj.grayzone?.toLowerCase() === 'true',
        welnet:   obj.welnet?.toLowerCase() === 'true',
        desc:     obj.desc || '',
        detail:   obj.detail || '',
        url:      obj.url || '',
        contact:  obj.contact || '',
      };
    })
    .filter(Boolean);
}

/**
 * Google Sheets からサービスデータを取得する
 * @returns {Promise<Array|null>} サービス配列、または失敗時は null
 */
export async function fetchServicesFromSheets() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8秒でタイムアウト

    const response = await fetch(CSV_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[Sheets] HTTP エラー: ${response.status}`);
      return null;
    }

    const text = await response.text();
    const rows = parseCSV(text);
    const services = rowsToServices(rows);

    if (services.length === 0) {
      console.log('[Sheets] データが空です（スプレッドシートが未入力）');
      return null;
    }

    console.log(`[Sheets] ${services.length} 件のサービスを取得しました`);
    return services;
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('[Sheets] タイムアウト（8秒）');
    } else {
      console.log('[Sheets] 取得エラー:', e.message);
    }
    return null;
  }
}
