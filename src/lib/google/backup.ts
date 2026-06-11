import { google } from 'googleapis';
import { GoogleBackupPayload } from '@/types';

function getGoogleAuth() {
  const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyString) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
  }

  let credentials;
  try {
    credentials = JSON.parse(keyString);
  } catch (error) {
    throw new Error('Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

// In-memory queue for rate-limited requests (Serverless envs will lose this on cold boot,
// but it suffices for immediate retries within the same container instance)
const rateLimitQueue: GoogleBackupPayload[] = [];

export async function appendTransactionRow(payload: GoogleBackupPayload): Promise<void> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Missing GOOGLE_SHEETS_SPREADSHEET_ID');
  }

  try {
    // 1. Check for idempotency (has txn_id already been added?)
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Transactions!A:A',
    });

    const existingIds = readResponse.data.values?.flat() || [];
    if (existingIds.includes(payload.transaction_id)) {
      console.log(`Transaction ${payload.transaction_id} already exists in backup. Skipping.`);
      return;
    }

    // 2. Append row
    const row = [
      payload.transaction_id,
      payload.timestamp,
      payload.student_id,
      payload.transaction_type,
      // The amount is in satang, converting back to decimal or keeping as satang (keeping as satang as per requirements)
      payload.amount,
      payload.description,
      payload.receipt_url || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log(`Successfully backed up transaction ${payload.transaction_id}`);
    
    // Drain queue if we have pending items and we succeeded
    if (rateLimitQueue.length > 0) {
       const nextItem = rateLimitQueue.shift();
       if (nextItem) {
          // Fire and forget
          appendTransactionRow(nextItem).catch(console.error);
       }
    }
  } catch (error: unknown) {
    console.error('Google Sheets API Error:', error);
    const err = error as { status?: number; code?: number };
    
    // Rate limit check
    if (err.status === 429 || err.code === 429) {
      console.warn(`Rate limited by Google APIs. Queueing transaction ${payload.transaction_id} for retry.`);
      rateLimitQueue.push(payload);
      // Return silently, never throw to caller on rate limits
      return;
    }
    
    throw error;
  }
}

export async function uploadReceiptPDF(pdfBuffer: Buffer, filename: string): Promise<string> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;

  if (!folderId) {
    throw new Error('Missing GOOGLE_DRIVE_BACKUP_FOLDER_ID');
  }

  // Ensure stream imports are handled correctly in nextjs/node environments
  const { Readable } = await import('stream');
  
  const fileMetadata = {
    name: filename,
    parents: [folderId],
  };

  const media = {
    mimeType: 'application/pdf',
    body: Readable.from(pdfBuffer),
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });

  return file.data.webViewLink || '';
}
