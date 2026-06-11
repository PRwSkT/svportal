import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET() {
  try {
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyString) {
      return NextResponse.json({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_KEY in Environment Variables' });
    }

    let creds;
    try {
      creds = JSON.parse(keyString);
    } catch(e: any) {
      return NextResponse.json({ 
        error: 'Invalid JSON format in GOOGLE_SERVICE_ACCOUNT_KEY', 
        details: e.message 
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
    });
    
    const results: any = {
      service_account_email: creds.client_email,
      drive_status: 'pending',
      sheets_status: 'pending'
    };

    // Test Drive
    try {
      const drive = google.drive({ version: 'v3', auth });
      const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
      if (!folderId) {
         results.drive_status = 'Missing GOOGLE_DRIVE_BACKUP_FOLDER_ID';
      } else {
         const dRes = await drive.files.get({ fileId: folderId, fields: 'id, name' });
         results.drive_status = `Success! Found folder: ${dRes.data.name}`;
      }
    } catch (dErr: any) {
      results.drive_status = `Error: ${dErr.message}`;
    }
    
    // Test Sheets
    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      if (!sheetId) {
         results.sheets_status = 'Missing GOOGLE_SHEETS_SPREADSHEET_ID';
      } else {
         const sRes = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
         results.sheets_status = `Success! Found sheet: ${sRes.data.properties?.title}`;
      }
    } catch (sErr: any) {
      results.sheets_status = `Error: ${sErr.message}`;
    }

    return NextResponse.json(results);

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
