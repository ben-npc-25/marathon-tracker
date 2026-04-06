import React, { useState, useEffect } from 'react';
import { Save, Zap, Loader2, X, Pencil, Activity, MessageCircle } from 'lucide-react';
import { analyzeLog } from '../utils/gemini';

const RPE_LABELS = ['', 'Very Easy', 'Easy', 'Moderate', 'Somewhat Hard', 'Hard', 'Hard+', 'Very Hard', 'Very Hard+', 'Max', 'All Out'];
const RPE_COLORS = ['', 'text-emerald-500', 'text-emerald-500', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-orange-400', 'text-orange-500', 'text-red-400', 'text-red-500', 'text-red-700'];

const LogModal = ({ isOpen, onClose, log, onSave, goal, onChat }) => {
  const [formData, setFormData] = useState({
    plannedActivity: '',
    actualDistance: '',
    durationStr: '',
    feeling: '',
    rpe: 5,
    coachFeedback: '',
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);

  useEffect(() => {
    if (log) {
      setFormData({
        plannedActivity: log.plannedActivity || '',
        actualDistance: log.actualDistance || '',
        durationStr: log.durationStr || '',
        feeling: log.feeling || '',
        rpe: log.rpe || 5,
        coachFeedback: log.coachFeedback || '',
      });
      setEditingPlan(false);
    }
  }, [log]);

  if (!isOpen || !log) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...log, ...formData });
    onClose();
  };

  const handleAnalyze = async () => {
    if (!formData.actualDistance) return;
    setIsAnalyzing(true);
    const feedback = await analyzeLog(
      { ...log, plannedActivity: formData.plannedActivity },
      formData,
      goal,
    );
    setFormData((prev) => ({ ...prev, coachFeedback: feedback }));
    setIsAnalyzing(false);
  };

  const set = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const dateLabel = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-0.5">
                {dateLabel}
              </p>

              {/* Planned activity — editable */}
              {editingPlan ? (
                <input
                  autoFocus
                  className="w-full text-base font-bold text-gray-900 border-b-2 border-indigo-400 outline-none pb-0.5 bg-transparent"
                  value={formData.plannedActivity}
                  placeholder="e.g. 10 km easy @ 5:30/km"
                  onChange={(e) => set('plannedActivity', e.target.value)}
                  onBlur={() => setEditingPlan(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingPlan(false)}
                />
              ) : (
                <button
                  onClick={() => setEditingPlan(true)}
                  className="flex items-center gap-1.5 group text-left"
                  title="Edit planned activity"
                >
                  <span className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                    {formData.plannedActivity || (
                      <span className="text-gray-400 font-normal italic">No plan — tap to add</span>
                    )}
                  </span>
                  <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

          {/* Distance + Time */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Workout Log</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Distance (km)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
                  placeholder="0.0"
                  value={formData.actualDistance}
                  onChange={(e) => set('actualDistance', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Duration</label>
                <input
                  type="text"
                  placeholder="e.g. 45:00"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
                  value={formData.durationStr}
                  onChange={(e) => set('durationStr', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* RPE */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Effort (RPE)</label>
              <span className={`text-sm font-bold ${RPE_COLORS[formData.rpe]}`}>
                {formData.rpe}/10 · {RPE_LABELS[formData.rpe]}
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="1"
                max="10"
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(formData.rpe - 1) / 9 * 100}%, #e5e7eb ${(formData.rpe - 1) / 9 * 100}%, #e5e7eb 100%)`
                }}
                value={formData.rpe}
                onChange={(e) => set('rpe', parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all text-sm"
              placeholder="How did it feel?"
              value={formData.feeling}
              onChange={(e) => set('feeling', e.target.value)}
            />
          </div>

          {/* AI Coach */}
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-4 border border-indigo-100">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">AI Coach</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!formData.actualDistance || isAnalyzing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  Analyze
                </button>
                {onChat && (
                  <button
                    type="button"
                    onClick={() => onChat({ ...log, ...formData })}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" />
                    Discuss
                  </button>
                )}
              </div>
            </div>
            <textarea
              className="w-full px-3 py-2.5 bg-white/70 border border-indigo-100 rounded-xl h-24 resize-none text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
              readOnly
              value={formData.coachFeedback}
              placeholder="Log your run then tap Analyze for a quick summary, or Discuss to chat with your coach…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogModal;
