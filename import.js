export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = req.cookies?.canva_access_token;
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { folderUrl } = req.body;
  if (!folderUrl) {
    return res.status(400).json({ error: 'No folder URL provided' });
  }

  // Extract Google Drive folder ID
  const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!folderIdMatch) {
    return res.status(400).json({ error: 'Invalid Google Drive folder URL' });
  }
  const driveFolderId = folderIdMatch[1];

  // Use Server-Sent Events for real-time progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send({ type: 'status', message: 'Fetching files from Google Drive...' });

    // Fetch file list from Google Drive (public folder, no auth needed)
    const apiKey = process.env.GOOGLE_API_KEY;
    let driveFiles = [];

    if (apiKey) {
      // Use Google Drive API if key is available
      let pageToken = null;
      do {
        const params = new URLSearchParams({
          q: `'${driveFolderId}' in parents and trashed=false`,
          fields: 'nextPageToken,files(id,name,mimeType)',
          key: apiKey,
          pageSize: '100',
        });
        if (pageToken) params.set('pageToken', pageToken);

        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
        const driveData = await driveRes.json();

        if (!driveRes.ok) {
          send({ type: 'error', message: 'Failed to read Google Drive folder. Make sure it is shared publicly.' });
          return res.end();
        }

        const imageFiles = (driveData.files || []).filter(f =>
          f.mimeType?.startsWith('image/') || f.mimeType === 'application/octet-stream'
        );
        driveFiles.push(...imageFiles);
        pageToken = driveData.nextPageToken;
      } while (pageToken);
    } else {
      // Fallback: use public export URL pattern
      // Try fetching the folder page to extract file IDs
      const pageRes = await fetch(`https://drive.google.com/drive/folders/${driveFolderId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const html = await pageRes.text();

      // Extract file IDs from the page
      const fileMatches = [...html.matchAll(/"([-\w]{33})","([^"]+)"/g)];
      driveFiles = fileMatches.map(m => ({ id: m[1], name: m[2] }));

      if (!driveFiles.length) {
        // Try alternate pattern
        const altMatches = [...html.matchAll(/\["([-\w]{28,})"/g)];
        driveFiles = [...new Set(altMatches.map(m => m[1]))].map(id => ({ id, name: id }));
      }
    }

    if (!driveFiles.length) {
      send({ type: 'error', message: 'No image files found in this folder. Make sure the folder is shared publicly ("Anyone with the link").' });
      return res.end();
    }

    send({ type: 'status', message: `Found ${driveFiles.length} files. Creating Canva folder...` });

    // Create folder in Canva
    const folderName = `Drive import — ${new Date().toLocaleDateString('nl-NL')}`;
    const folderRes = await fetch('https://api.canva.com/rest/v1/folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: folderName, parent_folder_id: 'uploads' }),
    });

    const folderData = await folderRes.json();
    if (!folderRes.ok) {
      send({ type: 'error', message: 'Failed to create Canva folder: ' + (folderData.message || 'Unknown error') });
      return res.end();
    }

    const canvaFolderId = folderData?.folder?.id;
    send({ type: 'folder', message: `Folder "${folderName}" created in Canva`, folderId: canvaFolderId });

    // Upload each file
    let done = 0;
    let failed = 0;

    for (const file of driveFiles) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

      try {
        const uploadRes = await fetch('https://api.canva.com/rest/v1/asset-uploads/url', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: downloadUrl,
            name: file.name || file.id,
            parent_folder_id: canvaFolderId,
          }),
        });

        if (uploadRes.ok) {
          done++;
          send({ type: 'progress', done, total: driveFiles.length, file: file.name || file.id, success: true });
        } else {
          failed++;
          send({ type: 'progress', done: done + failed, total: driveFiles.length, file: file.name || file.id, success: false });
        }
      } catch (e) {
        failed++;
        send({ type: 'progress', done: done + failed, total: driveFiles.length, file: file.name || file.id, success: false });
      }
    }

    send({
      type: 'done',
      message: `Import complete — ${done} uploaded, ${failed} failed`,
      done,
      failed,
    });

  } catch (err) {
    console.error('Import error:', err);
    send({ type: 'error', message: 'Unexpected error: ' + err.message });
  }

  res.end();
}
