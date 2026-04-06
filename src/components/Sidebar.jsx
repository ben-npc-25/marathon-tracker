import React from 'react';
import { Activity, Plus, Flag, LogIn, LogOut } from 'lucide-react';
import { auth } from '../firebase-config';
import { signOut } from 'firebase/auth';

const Sidebar = ({ user, plans, currentPlanId, onSelectPlan, onNewPlan, onShowAuth }) => {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">

      {/* Logo */}
      <div className="p-5 pb-4 flex items-center gap-2.5 border-b border-gray-100">
        <div className="p-1.5 bg-indigo-600 rounded-lg">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-widest text-gray-900 uppercase">Runner's Log</h1>
          <p className="text-[10px] text-gray-400 tracking-wide">AI Training Companion</p>
        </div>
      </div>

      {/* Plans list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Plans</span>
          <button
            onClick={onNewPlan}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="New Plan"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPlan(p.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2.5
                ${currentPlanId === p.id
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <Flag className={`w-3.5 h-3.5 flex-shrink-0 ${currentPlanId === p.id ? 'text-indigo-200' : 'text-gray-400'}`} />
              <span className="truncate">{p.title}</span>
            </button>
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-10">
            <Activity className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-xs">No plans yet.</p>
            <button
              onClick={onNewPlan}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
            >
              Create your first plan →
            </button>
          </div>
        )}
      </div>

      {/* Auth */}
      <div className="p-4 border-t border-gray-100">
        {user && !user.isAnonymous ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{user.email}</p>
                <p className="text-[10px] text-gray-400">Synced</p>
              </div>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="text-gray-300 hover:text-red-400 transition-colors p-1"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onShowAuth}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In / Sign Up
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
