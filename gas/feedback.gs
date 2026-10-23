// Google Apps Script: フィードバックをアプリ別シートに保存し、メールで通知する。
// Apps Script エディタの既存コードをこの内容に置き換えて、新しいバージョンとして再デプロイする。

var ALLOWED_APPS = ['NagoyaApp', 'nagoya-fukushi-navi'];
// 通知メールの宛先（複数の場合はカンマ区切り）
var NOTIFY_TO = 'a.nishihara@wappa-no-kai.jp';
var HEADERS = ['タイムスタンプ', '使いやすさ', 'ご感想・改善点', '返信用メールアドレス', 'お名前', '年齢'];

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
    if (appName !== '共通' && ALLOWED_APPS.indexOf(appName) === -1) {
      throw new Error('Unknown appName');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
