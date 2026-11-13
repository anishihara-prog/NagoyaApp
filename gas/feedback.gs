// Google Apps Script: フィードバックを保存・通知し、端末ごとの来場者数を集計する。
// Apps Script エディタの既存コードをこの内容に置き換えて、新しいバージョンとして再デプロイする。

var ALLOWED_APPS = ['NagoyaApp', 'nagoya-fukushi-navi'];
var SPREADSHEET_ID = '1-jTS-G7j4OSekAV6l0VXrQ-iWo9Q39Ft53J4A2JY02c';
// 通知メールの宛先（複数の場合はカンマ区切り）
var NOTIFY_TO = 'a.nishihara@wappa-no-kai.jp';
var HEADERS = ['タイムスタンプ', '使いやすさ', 'ご感想・改善点', '返信用メールアドレス', 'お名前', '年齢'];
var VISITOR_HEADERS = ['端末ID', '初回訪問日時'];

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function isAllowedApp(appName) {
  return ALLOWED_APPS.indexOf(appName) !== -1;
}

function getVisitorSheet(appName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(appName + '_Visitors');
  if (!sheet) {
    sheet = ss.insertSheet(appName + '_Visitors');
    sheet.appendRow(VISITOR_HEADERS);
  }
  return sheet;
}

function registerVisitor(appName, visitorId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId || '')) {
    throw new Error('Invalid visitorId');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getVisitorSheet(appName);
    var lastRow = sheet.getLastRow();
    var ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    var exists = ids.some(function(row) { return row[0] === visitorId; });
    if (!exists) {
      sheet.appendRow([visitorId, new Date()]);
      lastRow += 1;
    }
    return Math.max(lastRow - 1, 0);
  } finally {
    lock.releaseLock();
  }
}

function getVisitorStats(appName, visitorId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getVisitorSheet(appName);
    var lastRow = sheet.getLastRow();
    var ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    return {
      visitorCount: Math.max(lastRow - 1, 0),
      registered: ids.some(function(row) { return row[0] === visitorId; }),
    };
  } finally {
    lock.releaseLock();
  }
}

function createResponse(payload, callback) {
  var output;
  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      throw new Error('Invalid callback');
    }
    output = ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output = ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return output;
}

function doGet(e) {
  var requestedCallback = e && e.parameter ? e.parameter.callback : '';
  var callback = requestedCallback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(requestedCallback)
    ? requestedCallback
    : '';
  try {
    if (requestedCallback && !callback) {
      throw new Error('Invalid callback');
    }
    var appName = e.parameter.appName;
    var visitorId = e.parameter.visitorId;
    if (!isAllowedApp(appName)) {
      throw new Error('Unknown appName');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId || '')) {
      throw new Error('Invalid visitorId');
    }
    var stats = getVisitorStats(appName, visitorId);
    return createResponse({ status: 'success', visitorCount: stats.visitorCount, registered: stats.registered }, callback);
  } catch (error) {
    console.error('Visitor count request failed: ' + error);
    return createResponse({ status: 'error', message: '来場者数を取得できませんでした。' }, callback);
  }
}

// スプレッドシートの数式として解釈されないよう、先頭の記号を無効化する
function sanitize(value) {
  var text = String(value == null ? '' : value).slice(0, 2000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function doPost(e) {
  try {
    // Web版は text/plain、ネイティブ版は application/json で届くが、どちらも本文はJSON
    var params = JSON.parse(e.postData.contents);

    var appName = params.appName || '共通';
    if (params.action === 'registerVisit') {
      if (!isAllowedApp(appName)) {
        throw new Error('Unknown appName');
      }
      var visitorCount = registerVisitor(appName, params.visitorId);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', visitorCount: visitorCount }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (appName !== '共通' && !isAllowedApp(appName)) {
      throw new Error('Unknown appName');
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(appName);
    if (!sheet) {
      sheet = ss.insertSheet(appName);
      sheet.appendRow(HEADERS);
    }

    // 既存タブには新しい見出し（お名前・年齢）を末尾に追加する
    if (sheet.getLastColumn() < HEADERS.length) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    var rating = sanitize(params.rating);
    var comment = sanitize(params.comment);
    var email = sanitize(params.email);
    var name = sanitize(params.name);
    var age = sanitize(params.age);
    sheet.appendRow([new Date(), rating, comment, email, name, age]);

    // 通知メールの失敗でフィードバックの保存結果は変えない
    try {
      notifyOwner(appName, rating, comment, email, name, age, ss.getUrl());
    } catch (mailError) {
      console.error('Notification failed: ' + mailError);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function notifyOwner(appName, rating, comment, email, name, age, sheetUrl) {
  var to = NOTIFY_TO;
  var body = [
    'アプリ: ' + appName,
    '使いやすさ: ' + rating,
    'お名前: ' + (name || '（未入力）'),
    '年齢: ' + (age || '（未入力）'),
    '返信用メールアドレス: ' + (email || '（未入力）'),
    '',
    'ご感想・改善点:',
    comment,
    '',
    'スプレッドシート: ' + sheetUrl,
  ].join('\n');
  MailApp.sendEmail(to, '[' + appName + '] 新しいフィードバックが届きました', body);
}
