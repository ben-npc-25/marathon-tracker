import React, { useState } from 'react';
import {
  Menu,
  Edit2,
  CheckCircle,
  MessageCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Download,
  Calendar,
} from 'lucide-react';

const PlanHeader = ({
  currentPlan,
  isAdjusting,
  onOpenSidebar,
  onChat,
  onAdjust,
  onDelete,
  onExportImport,
  onUpdateTitle,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(currentPlan?.title || '');

  const handleTitleSave = () => {
    if (editedTitle.trim()) onUpdateTitle(editedTitle.trim());
    setIsEditingTitle(false);
  };

  const handleStartEdit = () => {
    setEditedTitle(currentPlan?.title || currentPlan?.goal || 'Untitled Plan');
    setIsEditingTitle(true);
  };

  const daysLeft = currentPlan?.raceDate
    ? Math.max(0, Math.ceil((new Date(currentPlan.raceDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center shadow-sm z-20">

      {/* Left: title + meta */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="text-lg font-bold text-gray-900 border-b-2 border-indigo-500 outline-none bg-transparent min-w-0"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
            />
            <button onClick={handleTitleSave} className="text-green-500 flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 group min-w-0"
            title="Click to rename"
          >
            <h2 className="text-lg font-bold text-gray-900 truncate">{currentPlan?.title}</h2>
            <Edit2 className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 text-gray-400 text-xs rounded-lg font-mono">
            <Calendar className="w-3 h-3" />
            {currentPlan?.startDate} → {currentPlan?.raceDate}
          </span>
          {daysLeft !== null && (
            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
              daysLeft <= 7
                ? 'bg-red-50 text-red-500 border border-red-100'
                : daysLeft <= 30
                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                : 'bg-indigo-50 text-indigo-500 border border-indigo-100'
            }`}>
              {daysLeft === 0 ? 'Race day!' : `${daysLeft}d to go`}
            </span>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <button
          onClick={onChat}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Coach</span>
        </button>

        <button
          onClick={onAdjust}
          disabled={isAdjusting}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
        >
          {isAdjusting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          <span className="hidden sm:inline">Adjust</span>
        </button>

        {/* Secondary actions */}
        <div className="flex items-center gap-1 pl-1 border-l border-gray-100">
          <button
            onClick={onExportImport}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Export / Import"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Plan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanHeader;
