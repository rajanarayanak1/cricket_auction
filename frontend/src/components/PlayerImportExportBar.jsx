import { useRef, useState } from 'react';
import { PlayersAPI } from '../api/client.js';
import { exportPlayersToExcel, parsePlayersExcelFile, mapImportRow } from '../utils/playerExcel.js';

export default function PlayerImportExportBar({ roomId, roomName, players, locked, onImportComplete }) {
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPlayersToExcel(players, roomName);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const rows = await parsePlayersExcelFile(file);
      const mapped = rows.map((row) => mapImportRow(row));
      const failed = mapped
        .filter((m) => m.errors)
        .map((m) => ({ rowNumber: m.rowNumber, reason: m.errors.join('; ') }));

      let successCount = 0;
      for (const item of mapped.filter((m) => !m.errors)) {
        try {
          const formData = new FormData();
          formData.append('name', item.data.name);
          formData.append('category', item.data.category);
          formData.append('base_value', item.data.base_value);
          formData.append('is_captain', item.data.is_captain);
          formData.append('is_icon', item.data.is_icon);
          if (item.data.photo) {
            const { buffer, extension } = item.data.photo;
            const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
            const fileExt = extension === 'jpeg' ? 'jpg' : extension;
            formData.append('photo', new Blob([buffer], { type: mimeType }), `row-${item.rowNumber}.${fileExt}`);
          } else if (item.data.photoUrl) {
            // Fetched and converted server-side (avoids browser CORS restrictions
            // on arbitrary third-party image URLs) — same WebP pipeline either way.
            formData.append('photo_url', item.data.photoUrl);
          }
          await PlayersAPI.create(roomId, formData);
          successCount += 1;
        } catch (err) {
          failed.push({
            rowNumber: item.rowNumber,
            reason: err.response?.data?.message || 'Failed to save'
          });
        }
      }

      setResult({ successCount, failed });
      if (successCount > 0) await onImportComplete();
    } catch (err) {
      setResult({
        successCount: 0,
        failed: [{ rowNumber: '—', reason: err.message || 'Could not read the file — make sure it is a valid .xlsx or .xls file.' }]
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" disabled={players.length === 0 || exporting} onClick={handleExport}>
          {exporting ? 'Exporting…' : '📤 Export to Excel'}
        </button>
        {!locked && (
          <>
            <button
              className="btn btn-secondary btn-sm"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Importing…' : '📥 Import from Excel'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
          </>
        )}
        {result && (
          <span className="hint-text">
            {result.successCount > 0 && `✅ ${result.successCount} player(s) imported.`}
            {result.failed.length > 0 && ` ⚠️ ${result.failed.length} row(s) skipped.`}
          </span>
        )}
      </div>
      {result && result.failed.length > 0 && (
        <p className="error-text" style={{ marginTop: 8 }}>
          {result.failed.map((f) => `Row ${f.rowNumber}: ${f.reason}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
