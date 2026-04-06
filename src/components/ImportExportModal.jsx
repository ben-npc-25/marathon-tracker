import React, { useRef, useState } from 'react';
import { Download, Upload, FileJson, FileText, X, AlertTriangle, Loader2 } from 'lucide-react';
import { exportPlanToJSON, exportPlanToCSV } from '../utils/exportImport';

const ImportExportModal = ({ isOpen, onClose, currentPlan, planLogs, onImport, isImporting }) => {
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const success = await onImport(event.target.result);
      if (success) {
        setImportSuccess(true);
        setTimeout(() => {
          onClose();
          setImportSuccess(false);
        }, 1500);
      } else {
        setImportError('Import failed. Check the file and try again.');
      }
    };
    reader.onerror = () => setImportError('Could not read file.');
    reader.readAsText(file);

    // Reset so same file can be re-selected if needed
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Import / Export</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentPlan && (
          <section className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Export Current Plan</h3>
            <div className="space-y-2">
              <button
                onClick={() => exportPlanToJSON(currentPlan, planLogs)}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left"
              >
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <FileJson className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Export as JSON</p>
                  <p className="text-xs text-gray-400">Full backup — plan + all workout logs</p>
                </div>
                <Download className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
              </button>

              <button
                onClick={() => exportPlanToCSV(currentPlan, planLogs)}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left"
              >
                <div className="p-2 bg-green-50 rounded-lg">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Export as CSV</p>
                  <p className="text-xs text-gray-400">Workout log for spreadsheets / analysis</p>
                </div>
                <Download className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Import Plan</h3>

          {importError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {importError}
            </div>
          )}
          {importSuccess && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-3 font-semibold">
              Plan imported successfully!
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition text-left disabled:opacity-50"
          >
            <div className="p-2 bg-gray-100 rounded-lg">
              {isImporting ? (
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {isImporting ? 'Importing...' : 'Import from JSON'}
              </p>
              <p className="text-xs text-gray-400">Creates a new plan from a previously exported file</p>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </section>
      </div>
    </div>
  );
};

export default ImportExportModal;
