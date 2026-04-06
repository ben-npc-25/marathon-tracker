import { useState } from 'react';
import { Activity, Loader2, Menu } from 'lucide-react';

import { useAuth } from './hooks/useAuth';
import { usePlans } from './hooks/usePlans';

import Sidebar from './components/Sidebar';
import PlanHeader from './components/PlanHeader';
import CalendarView from './components/CalendarView';
import LogModal from './components/LogModal';
import CreatePlanModal from './components/CreatePlanModal';
import ChatModal from './components/ChatModal';
import AuthModal from './components/AuthModal';
import ImportExportModal from './components/ImportExportModal';

export default function App() {
  const { user, loading: authLoading } = useAuth();

  const {
    plans,
    currentPlanId,
    setCurrentPlanId,
    currentPlan,
    planLogs,
    isCreatingPlan,
    isAdjusting,
    error,
    setError,
    handleCreatePlan,
    handleDeletePlan,
    handleSaveLog,
    handleUpdateTitle,
    handleAdjustPlan,
    handleChatUpdatePlan,
    handleImportPlan,
  } = usePlans(user);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [chatWorkoutContext, setChatWorkoutContext] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleOpenChatFromLog = (workoutData) => {
    setSelectedLog(null);
    setChatWorkoutContext(workoutData);
    setShowChatModal(true);
  };

  const handleDeleteWithConfirm = () => {
    if (window.confirm('Are you sure you want to delete this plan? This cannot be undone.')) {
      handleDeletePlan();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          user={user}
          plans={plans}
          currentPlanId={currentPlanId}
          onSelectPlan={(id) => { setCurrentPlanId(id); setIsSidebarOpen(false); }}
          onNewPlan={() => { setShowCreateModal(true); setIsSidebarOpen(false); }}
          onShowAuth={() => setShowAuthModal(true)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {error && (
          <div className="bg-red-50 border-b border-red-100 text-red-600 px-4 py-2.5 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-700 font-bold">✕</button>
          </div>
        )}

        {currentPlan ? (
          <>
            <PlanHeader
              currentPlan={currentPlan}
              isAdjusting={isAdjusting}
              onOpenSidebar={() => setIsSidebarOpen(true)}
              onChat={() => setShowChatModal(true)}
              onAdjust={handleAdjustPlan}
              onDelete={handleDeleteWithConfirm}
              onExportImport={() => setShowImportExportModal(true)}
              onUpdateTitle={handleUpdateTitle}
            />
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-5xl mx-auto p-4 sm:p-8">
                <CalendarView
                  currentPlan={currentPlan}
                  planLogs={planLogs}
                  onDayClick={setSelectedLog}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="relative flex-1 flex flex-col items-center justify-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="text-center px-6">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Activity className="w-10 h-10 text-indigo-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">No plan selected</h2>
              <p className="text-gray-400 text-sm mb-6">Create a training plan to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
              >
                Create First Plan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (data) => {
          const ok = await handleCreatePlan(data);
          if (ok) setShowCreateModal(false);
        }}
        isCreating={isCreatingPlan}
      />

      <ChatModal
        isOpen={showChatModal}
        onClose={() => { setShowChatModal(false); setChatWorkoutContext(null); }}
        goal={currentPlan?.goal}
        currentPlan={currentPlan}
        onUpdatePlan={handleChatUpdatePlan}
        workoutContext={chatWorkoutContext}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <LogModal
        isOpen={!!selectedLog}
        log={selectedLog}
        goal={currentPlan?.goal}
        onClose={() => setSelectedLog(null)}
        onSave={handleSaveLog}
        onChat={handleOpenChatFromLog}
      />

      <ImportExportModal
        isOpen={showImportExportModal}
        onClose={() => setShowImportExportModal(false)}
        currentPlan={currentPlan}
        planLogs={planLogs}
        onImport={handleImportPlan}
        isImporting={isCreatingPlan}
      />
    </div>
  );
}
