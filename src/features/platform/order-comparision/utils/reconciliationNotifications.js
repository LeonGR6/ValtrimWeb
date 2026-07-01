export function getPersistenceNotifications(result) {
  const notifications = [];
  const database = result?.persistence?.database;
  const sheets = result?.persistence?.sheets;

  if (database?.ok === true) {
    notifications.push({
      tone: 'success',
      title: 'Database saved',
      message: 'The reconciled purchase order was stored successfully.',
    });
  } else if (database?.ok === false) {
    notifications.push({
      tone: 'error',
      title: 'Database save failed',
      message: database.error || 'The reconciliation could not be stored.',
    });
  }

  if (sheets?.ok === false) {
    notifications.push({
      tone: 'warning',
      title: 'Google Sheets failed',
      message: sheets.error || 'The database was saved, but the purchasing sheet was not updated.',
    });
  }

  return notifications;
}
