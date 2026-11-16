import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bucket: string; key: string[] }> }
) {
  try {
    const { bucket, key } = await params;

    // Validate bucket
    if (!bucket || !/^[a-zA-Z0-9_-]+$/.test(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket name' }, { status: 400 });
    }

    // Validate key & prevent path traversal
    if (!key || !Array.isArray(key) || key.length === 0) {
      return NextResponse.json({ error: 'Missing object key' }, { status: 400 });
    }

    for (const segment of key) {
      if (!segment || segment === '..' || segment.includes('\\') || segment.includes('/')) {
        return NextResponse.json({ error: 'Invalid key path segment' }, { status: 400 });
      }
    }

    const keyPath = key.join('/');

    // 1. Try reading from @netlify/blobs
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getStore } = require('@netlify/blobs');
      const store = getStore(bucket);
      const blobResult = await store.getWithMetadata(keyPath, { type: 'arrayBuffer' });
      if (blobResult && blobResult.data) {
        const metadata = (blobResult.metadata as Record<string, string>) || {};
        const contentType =
          metadata.contentType ||
          metadata['content-type'] ||
          guessMimeType(keyPath);

        return new Response(blobResult.data, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch {
      // Not in Netlify environment or error calling getStore, fall back to local disk
    }

    // 2. Fallback to local filesystem (.netlify/blobs-local/<bucket>/<keyPath>)
    const safeBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, '_');
    const localFilePath = path.join(
      process.cwd(),
      '.netlify',
      'blobs-local',
      safeBucket,
      ...key
    );

    if (fs.existsSync(localFilePath)) {
      const fileBuffer = await fs.promises.readFile(localFilePath);
      let contentType = guessMimeType(keyPath);

      const metaPath = `${localFilePath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        try {
          const metaContent = await fs.promises.readFile(metaPath, 'utf-8');
          const metaJson = JSON.parse(metaContent);
          if (metaJson.contentType) {
            contentType = metaJson.contentType;
          }
        } catch {
          // ignore metadata parse error
        }
      }

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Blob serve error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to serve blob' },
      { status: 500 }
    );
  }
}
