/**
 * 出退勤管理アプリ バックエンド (Google Apps Script)
 * 仕様に基づき、打刻記録、休憩計算、LINE通知、課題完了報告を処理します。
 */

// ユーザー設定 (適宜変更してください)
const SPREADSHEET_ID = '1MOzxb7RKuxVMHQI7djPIu2iw6Hf3GLeg71_9oQi6FS8';
const LINE_ACCESS_TOKEN = 'YOZ7UftinQaO3OyBDaloYu4cXzhYtLzmqBzAGNvCIJRg7h+DoqsX0n6OXdfOFZ9vI7/+VIOKgdWLHJ6yBmeAi6kPqz4+FZ3vpHQTBEAQSHA81c9tQLH/8oP8UUyRpnHxvmJ0QlaAjZWiraJeO38tBgdB04t89/1O/w1cDnyilFU=';
const LINE_GROUP_ID = 'C5a5b36e27a78ed6cfbb74839a8a9d04e';

/**
 * Web App で POST リクエストを受け取る
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { type, traineeId, name, appUrl } = data;
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const now = new Date();
    const dateStr = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd');
    const timeStr = Utilities.formatDate(now, 'JST', 'HH:mm');
    const dateTimeStr = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd HH:mm');

    let result = { status: 'success' };

    switch (type) {
      case 'clock-in':
        handleClockIn(ss, traineeId, name, dateStr, timeStr, dateTimeStr);
        break;
      case 'clock-out':
        handleClockOut(ss, traineeId, name, dateStr, timeStr);
        break;
      case 'break-start':
        handleBreak(ss, traineeId, name, dateStr, timeStr, 'start');
        break;
      case 'break-end':
        handleBreak(ss, traineeId, name, dateStr, timeStr, 'end');
        break;
      case 'assignment':
        handleAssignment(ss, traineeId, name, dateTimeStr, appUrl);
        break;
      default:
        throw new Error('不明な打刻種別です');
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 出勤処理
 */
function handleClockIn(ss, traineeId, name, dateStr, timeStr, dateTimeStr) {
  const sheet = ss.getSheetByName('打刻記録');
  // 日付, 研修生ID, 氏名, 出勤時刻, 退勤時刻, 休憩時間, 勤務時間
  sheet.appendRow([dateStr, traineeId, name, timeStr, '', '', '']);
  
  const message = `【出勤】\n${name}\n${dateTimeStr}`;
  sendLineMessage(message);
}

/**
 * 退勤処理
 */
function handleClockOut(ss, traineeId, name, dateStr, timeStr) {
  const sheet = ss.getSheetByName('打刻記録');
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  
  // 最後に「出勤」して「退勤」が空の行を探す
  for (let i = data.length - 1; i >= 1; i--) {
     let rowDate = data[i][0];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, 'JST', 'yyyy/MM/dd');
    }
    if (rowDate === dateStr && data[i][1] === traineeId && data[i][4] === '') {
      rowIdx = i + 1;
      break;
    }
  }

  if (rowIdx !== -1) {
    const rowData = data[rowIdx-1];
    const clockInTimeStr = rowData[3];
    let breakDuration = rowData[5] || '00:00';

    // 退勤時刻をセット
    sheet.getRange(rowIdx, 5).setValue(timeStr);
    
    // 勤務時間を計算
    const workTime = calculateNetWorkTime(clockInTimeStr, timeStr, breakDuration);
    sheet.getRange(rowIdx, 7).setValue(workTime);

    const message = `【退勤】\n${name}\n出勤：${clockInTimeStr}\n退勤：${timeStr}\n休憩：${breakDuration}\n勤務時間：${workTime}`;
    sendLineMessage(message);
  } else {
    throw new Error('当日の出勤記録が見つかりません');
  }
}

/**
 * 休憩開始・終了の記録
 */
function handleBreak(ss, traineeId, name, dateStr, timeStr, phase) {
  const sheet = ss.getSheetByName('打刻記録');
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  
  for (let i = data.length - 1; i >= 1; i--) {
    let rowDate = data[i][0];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, 'JST', 'yyyy/MM/dd');
    }
    if (rowDate === dateStr && data[i][1] === traineeId && data[i][4] === '') {
      rowIdx = i + 1;
      break;
    }
  }

  if (rowIdx !== -1) {
    if (phase === 'start') {
      sheet.getRange(rowIdx, 6).setValue('@' + timeStr);
    } else {
      const currentBreakVal = sheet.getRange(rowIdx, 6).getValue();
      if (typeof currentBreakVal === 'string' && currentBreakVal.startsWith('@')) {
        const bStartStr = currentBreakVal.substring(1);
        const bEndStr = timeStr;
        const diffMin = getDiffInMinutes(bStartStr, bEndStr);
        const formattedBreak = formatMinutesToHHMM(diffMin);
        sheet.getRange(rowIdx, 6).setValue(formattedBreak);
      }
    }
  }
}

/**
 * 課題完了報告
 */
function handleAssignment(ss, traineeId, name, dateTimeStr, appUrl) {
  const sheet = ss.getSheetByName('課題完了記録');
  // 完了日時, 研修生ID, 氏名, アプリURL, 判定
  sheet.appendRow([dateTimeStr, traineeId, name, appUrl, '未確認']);
  
  const message = `【🎉課題完了報告🎉】\n研修生：${name}（${traineeId}）\n完了：${dateTimeStr}\nアプリURL: ${appUrl}\n確認をお願いします！`;
  sendLineMessage(message);
}

/**
 * LINE Messaging API を使用してプッシュ通知を送る
 */
function sendLineMessage(text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: LINE_GROUP_ID,
    messages: [{ type: 'text', text: text }]
  };
  
  try {
    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log('LINE通知失敗: ' + e.toString());
  }
}

function calculateNetWorkTime(startStr, endStr, breakDurStr) {
  const startMin = timeToMinutes(startStr);
  const endMin = timeToMinutes(endStr);
  let totalMin = endMin - startMin;
  if (totalMin < 0) totalMin += 24 * 60;

  const breakMin = timeToMinutes(breakDurStr.replace('@', ''));
  const netMin = totalMin - breakMin;
  return formatMinutesToHHMM(netMin);
}

function getDiffInMinutes(startStr, endStr) {
  const s = timeToMinutes(startStr);
  const e = timeToMinutes(endStr);
  let d = e - s;
  if (d < 0) d += 24 * 60;
  return d;
}

function timeToMinutes(tStr) {
  if (!tStr || typeof tStr !== 'string' || !tStr.includes(':')) return 0;
  const parts = tStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function formatMinutesToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
