import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { dateToISO } from '../utils/dates';

const CreatePlanModal = ({ isOpen, onClose, onCreate, isCreating }) => {
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(dateToISO(new Date()));
  const [raceDate, setRaceDate] = useState(
    dateToISO(new Date(new Date().setDate(new Date().getDate() + 90))),
  );
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (raceDate <= startDate) {
      setValidationError('Race date must be after start date.');
      return;
    }
    setValidationError('');
    onCreate({ goal, startDate, raceDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">New Training Plan</h2>

        {validationError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Goal / Race Name</label>
            <input
              required
              type="text"
              className="w-full p-3 border rounded-lg"
              placeholder="e.g. Tokyo Marathon Sub-4"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
              <input
                required
                type="date"
                className="w-full p-3 border rounded-lg"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Race Date</label>
              <input
                required
                type="date"
                className="w-full p-3 border rounded-lg"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 p-3 rounded-lg font-bold text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 p-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}{' '}
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePlanModal;
