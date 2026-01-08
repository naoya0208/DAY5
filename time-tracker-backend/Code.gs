/**
 * Clock-in App Backend (GAS)
 * 
 * Properties:
 * - SPREADSHEET_ID: 1sh42sVYw-QAaObKc3I5hOLjjQpX2FXJfaK5TCDjo9gs
 * - LINE_CHANNEL_ACCESS_TOKEN: YOZ7UftinQa...
 * - LINE_GROUP_ID: C5a5b36e27a78ed6cfbb74839a8a9d04e
 */

const SPREADSHEET_ID = '1sh42sVYw-QAaObKc3I5hOLjjQpX2FXJfaK5TCDjo9gs';
const LINE_ACCESS_TOKEN = 'YOZ7UftinQaO3OyBDaloYu4cXzhYtLzmqBzAGNvCIJRg7h+DoqsX0n6OXdfOFZ9vI7/+VIOKgdWLHJ6yBmeAi6kPqz4+FZ3vpHQTBEAQSHA81c9tQLH/8oP8UUyRpnHxvmJ0QlaAjZWiraJeO38tBgdB04t89/1O/w1cDnyilFU=';
const LINE_GROUP_ID = 'C5a5b36e27a78ed6cfbb74839a8a9d04e';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const { type, traineeId, name, appUrl } = data;
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd');
  const timeStr = Utilities.formatDate(now, 'JST', 'HH:mm');
  const dateTimeStr = Utilities.formatDate(now, 'JST', 'yyyy/MM/dd HH:mm');

  if (type === 'clock-in') {
    handleClockIn(ss, traineeId, name, dateStr, timeStr, dateTimeStr);
  } else if (type === 'clock-out') {
    handleClockOut(ss, traineeId, name, dateStr, timeStr);
  } else if (type === 'break-start') {
    handleBreak(ss, traineeId, name, dateStr, timeStr, 'start');
  } else if (type === 'break-end') {
    handleBreak(ss, traineeId, name, dateStr, timeStr, 'end');
  } else if (type === 'assignment') {
    handleAssignment(ss, traineeId, name, dateTimeStr, appUrl);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleClockIn(ss, traineeId, name, dateStr, timeStr, dateTimeStr) {
  const sheet = ss.getSheetByName('打刻記録');
  sheet.appendRow([dateStr, traineeId, name, timeStr, '', '', '', '']);
  
  const message = `【出勤】\n${name}\n${dateTimeStr}`;
  sendLineMessage(message);
}

function handleClockOut(ss, traineeId, name, dateStr, timeStr) {
  const sheet = ss.getSheetByName('打刻記録');
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  
  // Find today's record for this trainee
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] instanceof Date) {
      const d = Utilities.formatDate(data[i][0], 'JST', 'yyyy/MM/dd');
      if (d === dateStr && data[i][1] === traineeId) {
        rowIdx = i + 1;
        break;
      }
    }
  }

  if (rowIdx !== -1) {
    sheet.getRange(rowIdx, 7).setValue(timeStr);
    const clockInTimeStr = data[rowIdx-1][3];
    // Calculate working time (Simple diff for now)
    const workTime = calculateWorkTime(clockInTimeStr, timeStr);
    sheet.getRange(rowIdx, 8).setValue(workTime);

    const message = `【退勤】\n${name}\n出勤：${clockInTimeStr}\n退勤：${timeStr}\n勤務：${workTime}`;
    sendLineMessage(message);
  }
}

function handleBreak(ss, traineeId, name, dateStr, timeStr, phase) {
  const sheet = ss.getSheetByName('打刻記録');
  const data = sheet.getDataRange().getValues();
  let rowIdx = -1;
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === traineeId) {
      rowIdx = i + 1;
      break;
    }
  }

  if (rowIdx !== -1) {
    const col = phase === 'start' ? 5 : 6;
    sheet.getRange(rowIdx, col).setValue(timeStr);
  }
}

function handleAssignment(ss, traineeId, name, dateTimeStr, appUrl) {
  const sheet = ss.getSheetByName('課題完了記録');
  sheet.appendRow([dateTimeStr, traineeId, name, appUrl, '完了']);
  
  const message = `【🎉課題完了報告🎉】\n研修生：${name}（${traineeId}）\n完了：${dateTimeStr}\n\nアプリURL: ${appUrl}\n確認をお願いします`;
  sendLineMessage(message);
}

function sendLineMessage(text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: LINE_GROUP_ID,
    messages: [{ type: 'text', text: text }]
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  });
}

function calculateWorkTime(startStr, endStr) {
  const start = parseTime(startStr);
  const end = parseTime(endStr);
  let diffMs = end - start;
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}時間${mins}分`;
}

function parseTime(tStr) {
  const parts = tStr.split(':');
  const d = new Date();
  d.setHours(parts[0], parts[1], 0, 0);
  return d.getTime();
}
