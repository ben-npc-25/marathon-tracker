import React, { useState, useEffect, useCallback } from 'react';
import { auth, db, GEMINI_API_KEY } from './firebase-config';
import {
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  deleteDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import {
  Activity,
  Target,
  Save,
  Plus,
  Loader2,
  Calendar,
  Zap,
  CheckCircle,
  Repeat,
  AlertTriangle,
  Edit2,
  Trash2,
  ChevronLeft,
  Flag,
  Trophy,
  MessageCircle,
  Sparkles,
  RefreshCw,
  LogOut,
  LogIn,
  Copy,
  Check,
  Mail,
  Lock,
  Menu,
  X
} from 'lucide-react';

// --- Configuration & Initialization ---

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// --- Utility Functions ---

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const dateToISO = (date) => date.toISOString().split('T')[0];

const getDaysArray = (start, end) => {
  const arr = [];
  for (let dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
    arr.push(dateToISO(new Date(dt)));
  }
  return arr;
};

const getMonthYear = (isoDate) => {
  const date = new Date(isoDate + 'T00:00:00');
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`
  };
};

// Generates the JSON schema for the training plan response
const getPlanSchema = () => ({
  type: "ARRAY",
  description: "A chronological list of training activities.",
  items: {
    type: "OBJECT",
    properties: {
      date: { "type": "STRING", description: "Date in YYYY-MM-DD format." },
      plannedActivity: { "type": "STRING", description: "The planned workout." },
    },
    required: ["date", "plannedActivity"]
  }
});

// --- API Logic ---

const generateTrainingPlan = async (goal, startDate, raceDate, existingLog = [], isAdjustment = false) => {
  const start = new Date(startDate);
  const race = new Date(raceDate);

  const today = new Date();
  const generationStartDate = isAdjustment ? dateToISO(today) : startDate;

  // Calculate 4 weeks from generation start
  const fourWeeksLater = new Date(generationStartDate);
  fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);
  const generationEndDate = fourWeeksLater < race ? fourWeeksLater : race;

  const generationEndDateStr = dateToISO(generationEndDate);

  let prompt;
  let systemPrompt;

  if (!isAdjustment) {
    systemPrompt = `You are a world-class running coach. Create a training plan for a user targeting a race on ${raceDate}. The plan starts on ${startDate}. 
    Generate the daily schedule ONLY from ${startDate} to ${generationEndDateStr}. 
    The output must be a JSON array and using metrics system (km).`;
    prompt = `Goal: ${goal}. Race Date: ${raceDate}. Start Date: ${startDate}. Generate the first phase of the plan.`;
  } else {
    const logSummary = existingLog.map(log =>
      `${log.date}: Planned "${log.plannedActivity}" -> Actual: ${log.actualDistance}km (${log.durationStr}), RPE ${log.rpe}, Notes: ${log.feeling}`
    ).join('\n');

    systemPrompt = `You are an adaptive running coach. The user is training for a race on ${raceDate}. 
    Review the recent logs and adjust the future plan starting from ${generationStartDate}.
    Generate the daily schedule ONLY from ${generationStartDate} to ${generationEndDateStr}.
    The output must be a JSON array.`;
    prompt = `Goal: ${goal}. Recent Logs:\n${logSummary}\n\nBased on these logs, generate the next phase of training starting ${generationStartDate}.`;
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: getPlanSchema()
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`API Request Failed: ${response.status}`);

    const result = await response.json();
    const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonString) throw new Error("No JSON returned");

    const cleanJsonString = jsonString.replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};

// --- Components ---

// Helper to separate calculating pace
const calculatePace = (distance, durationStr) => {
  if (!distance || !durationStr) return null;
  const dist = parseFloat(distance);
  if (isNaN(dist) || dist <= 0) return null;

  // Parse duration "MM:SS" or "HH:MM:SS"
  const parts = durationStr.split(':').map(Number);
  let totalMinutes = 0;
  if (parts.length === 2) {
    totalMinutes = parts[0] + parts[1] / 60;
  } else if (parts.length === 3) {
    totalMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
  } else {
    return null;
  }

  if (totalMinutes <= 0) return null;

  const paceDec = totalMinutes / dist;
  const paceMin = Math.floor(paceDec);
  const paceSec = Math.round((paceDec - paceMin) * 60);
  return `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
};

const LogModal = ({ isOpen, onClose, log, onSave, onAnalyze, goal }) => {
  if (!isOpen || !log) return null;

  // Migration: If log has no 'activities' array but has legacy fields, create first activity
  const initialActivities = log.activities || (log.actualDistance ? [{
    actualDistance: log.actualDistance,
    durationStr: log.durationStr,
    rpe: log.rpe,
    feeling: log.feeling
  }] : [{ actualDistance: '', durationStr: '', rpe: 5, feeling: '' }]);

  const [activities, setActivities] = useState(initialActivities);
  const [coachFeedback, setCoachFeedback] = useState(log.coachFeedback || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Reset state when modal opens with new log
    const startActs = log.activities || (log.actualDistance ? [{
      actualDistance: log.actualDistance,
      durationStr: log.durationStr,
      rpe: log.rpe,
      feeling: log.feeling
    }] : [{ actualDistance: '', durationStr: '', rpe: 5, feeling: '' }]);

    setActivities(startActs);
    setCoachFeedback(log.coachFeedback || '');
  }, [log]);

  const handleActivityChange = (index, field, value) => {
    const newActs = [...activities];
    newActs[index] = { ...newActs[index], [field]: value };
    setActivities(newActs);
  };

  const addActivity = () => {
    setActivities([...activities, { actualDistance: '', durationStr: '', rpe: 5, feeling: '' }]);
  };

  const removeActivity = (index) => {
    if (activities.length === 1) return; // Keep at least one
    const newActs = activities.filter((_, i) => i !== index);
    setActivities(newActs);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Summarize for top-level legacy support (optional, but good for list view)
    // We will pick the "primary" (activity 0) or sum them up. 
    // Let's sum distance, pick max RPE, sum time (roughly).
    // For now, let's just save the activities array and let the parent handle display logic or use the first one.

    const totalDist = activities.reduce((acc, curr) => acc + (parseFloat(curr.actualDistance) || 0), 0);
    // Simple sum of strings is hard, let's just keep the activities structure as the source of truth.
    // We will populate the legacy fields from the FIRST activity so the calendar view doesn't break immediately if it uses them.
    const primary = activities[0];

    onSave({
      ...log,
      activities: activities,
      coachFeedback,
      // Legacy Back-compat:
      actualDistance: totalDist > 0 ? totalDist.toFixed(1) : (primary.actualDistance || ''),
      durationStr: primary.durationStr, // Showing only first duration in summary for now
      rpe: Math.max(...activities.map(a => a.rpe || 5)),
      feeling: activities.map(a => a.feeling).filter(Boolean).join(' | ')
    });
  };

  const handleAnalyze = async () => {
    // Analyze all activities
    if (activities.every(a => !a.actualDistance)) return;
    setIsAnalyzing(true);

    // Construct a composite log object for the analyzer
    const compositeLog = {
      ...log,
      actualDistance: activities.map(a => a.actualDistance).join('+'),
      durationStr: activities.map(a => a.durationStr).join('+'),
      rpe: activities.map(a => a.rpe).join(','),
      feeling: activities.map(a => a.feeling).join('. ')
    };

    // We pass a dummy single-object form data
    const feedback = await onAnalyze(log, compositeLog, goal);
    setCoachFeedback(feedback);
    setIsAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{log.date}</h3>
            <p className="text-md text-indigo-600 font-semibold">{log.plannedActivity || "Rest / No Plan"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {activities.map((activity, index) => {
            const pace = calculatePace(activity.actualDistance, activity.durationStr);
            return (
              <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
                {activities.length > 1 && (
                  <div className="absolute top-2 right-2 text-xs font-bold text-slate-300">#{index + 1}</div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Distance (km)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full p-3 bg-white border rounded-lg"
                      value={activity.actualDistance}
                      onChange={e => handleActivityChange(index, 'actualDistance', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Time (MM:SS)</label>
                    <input
                      type="text"
                      placeholder="MM:SS"
                      className="w-full p-3 bg-white border rounded-lg"
                      value={activity.durationStr}
                      onChange={e => handleActivityChange(index, 'durationStr', e.target.value)}
                    />
                  </div>
                </div>

                {/* Pace Display */}
                {pace && (
                  <div className="mb-4 text-xs font-bold text-indigo-500 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Average Pace: {pace}
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1"><span>RPE</span><span className="font-bold text-indigo-600">{activity.rpe}/10</span></div>
                  <input type="range" min="1" max="10" className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={activity.rpe} onChange={e => handleActivityChange(index, 'rpe', parseInt(e.target.value))} />
                </div>
                <textarea
                  className="w-full p-3 bg-white border rounded-lg h-16 resize-none text-sm"
                  placeholder="How did it feel?"
                  value={activity.feeling}
                  onChange={e => handleActivityChange(index, 'feeling', e.target.value)}
                />

                {activities.length > 1 && (
                  <button type="button" onClick={() => removeActivity(index)} className="mt-2 text-xs text-red-400 hover:text-red-600 underline">Remove this session</button>
                )}
              </div>
            );
          })}

          <button type="button" onClick={addActivity} className="w-full py-2 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-400 font-bold text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-colors">
            + Add Another Session
          </button>

          {/* AI Feedback */}
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-indigo-700 uppercase">AI Coach</label>
              <button type="button" onClick={handleAnalyze} disabled={isAnalyzing} className="text-xs px-3 py-1 rounded-full font-bold bg-indigo-200 text-indigo-700 hover:bg-indigo-300 flex items-center gap-1">
                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Analyze All
              </button>
            </div>
            <textarea className="w-full p-3 bg-white border border-indigo-200 rounded-lg h-24 resize-none text-sm" readOnly value={coachFeedback} placeholder="Feedback will appear here..." />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 p-3 rounded-lg font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
            <button type="submit" className="flex-1 p-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreatePlanModal = ({ isOpen, onClose, onCreate, isCreating }) => {
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(dateToISO(new Date()));
  const [raceDate, setRaceDate] = useState(dateToISO(new Date(new Date().setDate(new Date().getDate() + 90)))); // Default 3 months

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({ goal, startDate, raceDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">New Training Plan</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Goal / Race Name</label>
            <input required type="text" className="w-full p-3 border rounded-lg" placeholder="e.g. Tokyo Marathon Sub-4" value={goal} onChange={e => setGoal(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
              <input required type="date" className="w-full p-3 border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Race Date</label>
              <input required type="date" className="w-full p-3 border rounded-lg" value={raceDate} onChange={e => setRaceDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 p-3 rounded-lg font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={isCreating} className="flex-1 p-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChatModal = ({ isOpen, onClose, goal = "General Training", onUpdatePlan, currentPlan }) => {
  const [messages, setMessages] = useState([
    { role: 'model', text: "Hi! I'm your AI running coach. Need to adjust your plan? Just ask!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      history.push({ role: 'user', parts: [{ text: userMsg.text }] });

      const planContext = currentPlan ? `
      Current Plan Context:
      - Goal: ${currentPlan.goal}
      - Start: ${currentPlan.startDate}
      - Race: ${currentPlan.raceDate}
      
      IF the user asks to CHANGE or UPDATE the plan (e.g. "Move long runs to Sunday", "Make it harder", "I missed a week"):
      1. Explain what you are changing.
      2. GENERATE a JSON array of daily activities for the AFFECTED DATES (or the whole remainder of the plan).
      3. WRAP the JSON in this EXACT delimiter: <<<PLAN_UPDATE>>> [ ... json ... ] <<<PLAN_UPDATE>>>
      4. The JSON must strictly follow this schema: Array of { "date": "YYYY-MM-DD", "plannedActivity": "String" }.
      5. Ensure dates are valid and within the plan range.
      ` : '';

      const systemPrompt = `You are an expert running coach. ${planContext}
      Keep normal advice concise. Only generate JSON if the user EXPLICITLY asks to change the schedule.`;

      const payload = {
        contents: history,
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

      // Check for Plan Update
      const updateMatch = reply.match(/<<<PLAN_UPDATE>>>([\s\S]*?)<<<PLAN_UPDATE>>>/);

      if (updateMatch && updateMatch[1]) {
        try {
          const jsonStr = updateMatch[1].trim();
          const newPlan = JSON.parse(jsonStr);

          if (Array.isArray(newPlan) && onUpdatePlan) {
            onUpdatePlan(newPlan);
            reply = reply.replace(updateMatch[0], "").trim() + "\n\n??**Plan Updated!**";
          }
        } catch (e) {
          console.error("Failed to parse plan update:", e);
          reply += "\n\n(Technical Error: Failed to apply plan update)";
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Error connecting to coach. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-full">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">AI Coach</h3>
              <p className="text-xs text-indigo-200 font-medium">Online | {goal}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-line
                ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'}
              `}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <input
            autoFocus
            type="text"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-base placeholder:text-slate-400"
            placeholder="Review my plan..."
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md active:scale-95"
          >
            <Zap className="w-5 h-5 fill-current" />
          </button>
        </form>
      </div>
    </div>
  );
};



const AuthModal = ({ isOpen, onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
        {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input required type="email" className="w-full p-3 pl-10 border rounded-lg" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input required type="password" className="w-full p-3 pl-10 border rounded-lg" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full p-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"} <button onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-600 font-bold hover:underline">{isSignUp ? 'Sign In' : 'Sign Up'}</button>
        </div>
        <button onClick={onClose} className="mt-4 w-full text-gray-400 text-xs hover:text-gray-600">Cancel</button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI State
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Plans State
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);

  // Logs State (for current plan)
  const [planLogs, setPlanLogs] = useState({}); // Map date -> log object

  // UI State
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
      else {
        // Wait for auth state to settle
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        // Optionally sign in anonymously if we want to allow guest usage, 
        // but for email/pass flow, maybe we just show "Sign In" state?
        // Let's stick to anonymous for guests so they can try it out.
        try {
          // Check if we are already signing in? 
          // Actually, if we want to enforce login for sync, we can let them be anon first.
          await signInAnonymously(auth);
        } catch (e) {
          // console.error("Anon auth failed", e);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Plans List
  useEffect(() => {
    if (!user) return;
    const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const plansRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'plans');
    const q = query(plansRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPlans = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlans(fetchedPlans);

      // Auto-select most recent if none selected
      if (fetchedPlans.length > 0 && !currentPlanId) {
        setCurrentPlanId(fetchedPlans[0].id);
      } else if (fetchedPlans.length === 0) {
        setCurrentPlanId(null); // Reset if no plans
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, currentPlanId]);

  // Fetch Current Plan Details & Logs
  useEffect(() => {
    if (!user || !currentPlanId) {
      setCurrentPlan(null);
      setPlanLogs({});
      return;
    }

    const selected = plans.find(p => p.id === currentPlanId);
    setCurrentPlan(selected);
    setEditedTitle(selected?.title || selected?.goal || 'Untitled Plan');

    const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const logsRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId, 'days');

    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      const logs = {};
      snapshot.docs.forEach(doc => {
        logs[doc.id] = { id: doc.id, ...doc.data() };
      });
      setPlanLogs(logs);
    });

    return () => unsubscribe();
  }, [user, currentPlanId, plans]);

  // Auto-scroll to today
  useEffect(() => {
    if (currentPlan && !loading) {
      setTimeout(() => {
        const todayEl = document.getElementById('active-today');
        if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500); // Small delay to ensure render
    }
  }, [currentPlan, loading]);

  // --- Handlers ---

  const handleCreatePlan = async ({ goal, startDate, raceDate }) => {
    if (!user) return;
    setIsCreatingPlan(true);
    try {
      const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const plansRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'plans');

      // 1. Create Plan Metadata
      const newPlanRef = await addDoc(plansRef, {
        goal,
        title: goal, // Default title is goal
        startDate,
        raceDate,
        createdAt: serverTimestamp()
      });

      // 2. Generate Initial Content (First 4 weeks)
      const generatedPlan = await generateTrainingPlan(goal, startDate, raceDate);

      if (generatedPlan) {
        const batch = writeBatch(db);
        const daysRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', newPlanRef.id, 'days');

        generatedPlan.forEach(day => {
          const docRef = doc(daysRef, day.date);
          batch.set(docRef, {
            ...day,
            actualDistance: '',
            durationStr: '',
            feeling: '',
            rpe: 5,
            coachFeedback: ''
          });
        });
        await batch.commit();
      }

      setCurrentPlanId(newPlanRef.id);
      setShowCreateModal(false);
    } catch (e) {
      console.error("Error creating plan:", e);
      alert("Failed to create plan.");
    }
    setIsCreatingPlan(false);
  };

  const handleDeletePlan = async () => {
    if (!user || !currentPlanId) return;
    if (!window.confirm("Are you sure you want to delete this plan? This cannot be undone.")) return;

    try {
      const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');

      const batch = writeBatch(db);
      const planRef = doc(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId);

      // Delete loaded logs
      Object.keys(planLogs).forEach(date => {
        const logRef = doc(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId, 'days', date);
        batch.delete(logRef);
      });

      // Delete plan
      batch.delete(planRef);

      await batch.commit();
      setCurrentPlanId(null);

    } catch (e) {
      console.error("Error deleting plan:", e);
      alert("Failed to delete plan.");
    }
  };

  const handleSaveLog = async (updatedLog) => {
    if (!user || !currentPlanId) return;
    const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const logRef = doc(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId, 'days', updatedLog.date);
    await setDoc(logRef, updatedLog, { merge: true });
    setSelectedLog(null);
  };

  const handleUpdateTitle = async () => {
    if (!user || !currentPlanId) return;
    const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const planRef = doc(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId);
    await setDoc(planRef, { title: editedTitle }, { merge: true });
    setIsEditingTitle(false);
  };

  const handleAnalyzeLog = async (plannedLog, actualFormData, currentGoal) => {
    // Re-using existing logic structure, just calling API
    const userPrompt = `Planned: "${plannedLog.plannedActivity}". Actual: ${actualFormData.actualDistance}km in ${actualFormData.durationStr}, RPE ${actualFormData.rpe}/10. Notes: "${actualFormData.feeling}". Goal: "${currentGoal}". Analyze performance.`;
    const systemInstruction = "You are a running coach. Provide concise feedback (max 3 sentences) and one tip.";

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || "No feedback generated.";
    } catch (e) {
      return "Error getting analysis.";
    }
  };

  const handleAdjustPlan = async () => {
    if (!user || !currentPlan) return;
    setIsAdjusting(true);

    // Gather logs with actual data
    const completedLogs = Object.values(planLogs).filter(l => l.actualDistance && parseFloat(l.actualDistance) > 0);

    const generatedPlan = await generateTrainingPlan(currentPlan.goal, currentPlan.startDate, currentPlan.raceDate, completedLogs, true);

    if (generatedPlan) {
      const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const batch = writeBatch(db);
      const daysRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId, 'days');

      generatedPlan.forEach(day => {
        const docRef = doc(daysRef, day.date);
        batch.set(docRef, {
          ...day,
        }, { merge: true });
      });
      await batch.commit();
      alert("Plan adjusted based on your logs!");
    } else {
      alert("Failed to adjust plan.");
    }
    setIsAdjusting(false);
  };

  const handleChatUpdatePlan = async (newDays) => {
    if (!user || !currentPlanId) return;

    // We expect newDays to be array of {date, plannedActivity}
    // We should merge this into existing days
    const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const batch = writeBatch(db);
    const daysRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'plans', currentPlanId, 'days');

    newDays.forEach(day => {
      if (day.date && day.plannedActivity) {
        const docRef = doc(daysRef, day.date);
        batch.set(docRef, {
          date: day.date,
          plannedActivity: day.plannedActivity
        }, { merge: true });
      }
    });

    try {
      await batch.commit();
      // Since we have a real-time listener on `planLogs`, the UI should update automatically.
    } catch (e) {
      console.error("Error updating plan from chat:", e);
      alert("Failed to update plan.");
    }
  };

  // --- Rendering Helpers ---

  const renderCalendar = () => {
    if (!currentPlan) return null;

    const allDates = getDaysArray(currentPlan.startDate, currentPlan.raceDate);

    // Group by Month
    const months = {};
    allDates.forEach(date => {
      const { key, label } = getMonthYear(date);
      if (!months[key]) months[key] = { label, days: [] };
      months[key].days.push(date);
    });

    return Object.values(months).map((month, mIndex) => (
      <div key={mIndex} className="mb-8">
        <h3 className="text-lg font-bold text-gray-700 mb-3 sticky top-0 bg-gray-50 py-2 z-10">{month.label}</h3>
        {/* Changed grid gap to provide more vertical spacing between weeks (md:gap-y-6) */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-x-2 gap-y-2 md:gap-y-2">
          {/* Day Headers - Desktop Only */}
          {mIndex === 0 && dayNames.map(d => (
            <div key={d} className="hidden md:block text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{d}</div>
          ))}
          {/* Offset for first day of month - Desktop Only */}
          {Array(new Date(month.days[0]).getDay()).fill(null).map((_, i) => <div key={`empty-${i}`} className="hidden md:block" />)}

          {month.days.map(date => {
            const log = planLogs[date];
            const isRaceDay = date === currentPlan.raceDate;
            const isToday = date === dateToISO(new Date());

            // Check completion: Supports new 'activities' array or legacy 'actualDistance'
            const hasActivities = log?.activities && log.activities.some(a => a.actualDistance && parseFloat(a.actualDistance) > 0);
            const hasLegacy = log?.actualDistance && parseFloat(log.actualDistance) > 0;
            const isCompleted = hasActivities || hasLegacy;

            // Activity Type Analysis
            const activityLower = log?.plannedActivity?.toLowerCase() || '';
            const isRest = activityLower === 'rest' || activityLower.startsWith('rest ') || activityLower.startsWith('rest/');

            const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

            // Styling Logic: Completed takes precedence over Rest styling
            let bgClass = "bg-white";
            if (isRaceDay) bgClass = "bg-yellow-100 border-yellow-400 ring-2 ring-yellow-400";
            else if (isCompleted) bgClass = "bg-green-50 border-green-200"; // Active Rest Day hits this too!
            else if (isRest) bgClass = "bg-gray-50 opacity-60";
            else if (isToday) bgClass = "bg-blue-50 border-blue-300";
            else if (!log) bgClass = "bg-gray-50 opacity-60"; // Future/Empty

            // Mobile Week Spacing: Add margin bottom if it's Saturday to separate weeks
            // Only on mobile (md:mb-0)
            const marginClass = dayOfWeek === 'Sat' ? 'mb-6 md:mb-0' : '';

            return (
              <div
                id={isToday ? "active-today" : null}
                onClick={() => setSelectedLog({ date, ...log, goal: currentPlan.goal })}
                className={`
                  relative p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md
                  min-h-[60px] md:min-h-[80px]
                  flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-3 md:gap-0
                  ${bgClass} ${marginClass}
                `}
              >
                {/* Date Header */}
                <div className="flex md:w-full justify-between items-center md:items-start md:mb-1 w-16 md:w-auto flex-shrink-0 flex-col md:flex-row">
                  <div className="flex flex-col md:block items-center md:items-start">
                    <span className="md:hidden text-[10px] font-bold text-gray-400 uppercase">{dayOfWeek}</span>
                    <span className={`text-sm md:text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{date.split('-')[2]}</span>
                  </div>
                  {isRaceDay && <Trophy className="w-4 h-4 text-yellow-600 hidden md:block" />}
                </div>

                {/* Content */}
                <div className="flex-1 text-left">
                  {log ? (
                    <p className={`text-sm md:text-xs font-semibold line-clamp-2 md:line-clamp-3 ${isRest && !isCompleted ? 'text-gray-400' : 'text-gray-800'}`}>{log.plannedActivity}</p>
                  ) : (
                    isRaceDay ? <p className="text-xs font-black text-yellow-800">RACE DAY!</p> : <p className="text-[10px] text-gray-400 italic">Rest / TBD</p>
                  )}
                </div>

                {/* Status Icons */}
                <div className="md:absolute md:bottom-1 md:right-1 flex-shrink-0">
                  {isCompleted && <CheckCircle className="w-5 h-5 md:w-3 md:h-3 text-green-500" />}
                  {isRaceDay && <Trophy className="w-5 h-5 text-yellow-600 md:hidden" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ));
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-100 flex items-center gap-2 text-indigo-600">
          <Activity className="w-6 h-6 flex-shrink-0" />
          <h1 className="text-lg font-black tracking-tight text-gray-900 leading-tight">MARATHON TRACKER</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase">My Plans</h2>
            <button onClick={() => setShowCreateModal(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Plus className="w-4 h-4" /></button>
          </div>

          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setCurrentPlanId(p.id)}
              className={`w-full text-left p-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                ${currentPlanId === p.id
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200'}
              `}
            >
              <Flag className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{p.title}</span>
            </button>
          ))}

          {plans.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No plans yet.<br />Create one to start!
            </div>
          )}
        </div>

        {/* Auth Section */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          {user && !user.isAnonymous ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="text-xs truncate">
                  <p className="font-bold text-gray-800 truncate">{user.email}</p>
                  <p className="text-gray-400 text-[10px]">Synced</p>
                </div>
              </div>
              <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-red-500">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full flex items-center justify-center gap-2 p-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <LogIn className="w-4 h-4" /> Sign In / Sign Up
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {currentPlan ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-20">
              <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1 text-gray-500 hover:bg-gray-100 rounded">
                  <Menu className="w-6 h-6" />
                </button>
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="text-xl font-bold text-gray-900 border-b-2 border-indigo-500 outline-none"
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value)}
                      onBlur={handleUpdateTitle}
                      onKeyDown={e => e.key === 'Enter' && handleUpdateTitle()}
                    />
                    <button onClick={handleUpdateTitle} className="text-green-600"><CheckCircle className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group overflow-hidden">
                    <h2 className="text-xl font-bold text-gray-900 truncate">{currentPlan.title}</h2>
                    <button onClick={() => setIsEditingTitle(true)} className="text-gray-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <span className="hidden sm:inline-block px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-mono flex-shrink-0">
                  {currentPlan.startDate} &rarr; {currentPlan.raceDate}
                </span>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowChatModal(true)}
                  className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-lg hover:bg-indigo-100 transition flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" /> Coach
                </button>
                <button
                  onClick={handleAdjustPlan}
                  disabled={isAdjusting}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isAdjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Adjust Plan
                </button>
                <button
                  onClick={handleDeletePlan}
                  className="px-3 py-2 bg-red-50 text-red-600 border border-red-100 text-sm font-semibold rounded-lg hover:bg-red-100 transition flex items-center gap-2"
                  title="Delete Plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Scroll Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto p-4 sm:p-8">
                {renderCalendar()}
              </div>
            </div>
          </>
        ) : (
          <div className="relative flex-1 flex flex-col items-center justify-center text-gray-400">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-4 left-4 md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Activity className="w-16 h-16 mb-4 opacity-20" />
            <p>Select a plan or create a new one.</p>
            <button onClick={() => setShowCreateModal(true)} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">
              Create First Plan
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePlanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePlan}
        isCreating={isCreatingPlan}
      />

      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        goal={currentPlan?.goal}
        currentPlan={currentPlan}
        onUpdatePlan={handleChatUpdatePlan}
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
        onAnalyze={handleAnalyzeLog}
      />
    </div>
  );
}
