import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronLeft, Zap } from 'lucide-react';
import { API_URL } from '../utils/gemini';

const buildWorkoutGreeting = (ctx) => {
  const parts = [`I can see your workout from **${ctx.date}**:`];
  if (ctx.plannedActivity) parts.push(`📋 Planned: ${ctx.plannedActivity}`);
  if (ctx.actualDistance) parts.push(`🏃 Ran: ${ctx.actualDistance} km${ctx.durationStr ? ` in ${ctx.durationStr}` : ''}`);
  if (ctx.rpe) parts.push(`💪 RPE: ${ctx.rpe}/10`);
  if (ctx.feeling) parts.push(`📝 Notes: "${ctx.feeling}"`);
  parts.push('\nWhat would you like to work on or discuss?');
  return parts.join('\n');
};

const ChatModal = ({ isOpen, onClose, goal = 'General Training', onUpdatePlan, currentPlan, workoutContext }) => {
  const defaultGreeting = workoutContext
    ? buildWorkoutGreeting(workoutContext)
    : "Hi! I'm your AI running coach. Need to adjust your plan? Just ask!";

  const [messages, setMessages] = useState([{ role: 'model', text: defaultGreeting }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Reset messages when workout context changes (new day opened)
  useEffect(() => {
    setMessages([{ role: 'model', text: workoutContext ? buildWorkoutGreeting(workoutContext) : "Hi! I'm your AI running coach. Need to adjust your plan? Just ask!" }]);
  }, [workoutContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      history.push({ role: 'user', parts: [{ text: userMsg.text }] });

      const planContext = currentPlan
        ? `
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
      `
        : '';

      const workoutDetail = workoutContext
        ? `\n      The user is asking about their workout on ${workoutContext.date}: planned "${workoutContext.plannedActivity || 'N/A'}", ran ${workoutContext.actualDistance || '?'} km in ${workoutContext.durationStr || '?'} at RPE ${workoutContext.rpe || '?'}/10. Notes: "${workoutContext.feeling || ''}". Focus on this session unless asked otherwise.`
        : '';

      const systemPrompt = `You are an expert running coach.${workoutDetail} ${planContext}
      Keep normal advice concise. Only generate JSON if the user EXPLICITLY asks to change the schedule.`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: history,
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
      });

      const data = await response.json();
      let reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't generate a response.";

      const updateMatch = reply.match(/<<<PLAN_UPDATE>>>([\s\S]*?)<<<PLAN_UPDATE>>>/);
      if (updateMatch?.[1]) {
        try {
          const newPlan = JSON.parse(updateMatch[1].trim());
          if (Array.isArray(newPlan) && onUpdatePlan) {
            onUpdatePlan(newPlan);
            reply = reply.replace(updateMatch[0], '').trim() + '\n\n✅ **Plan Updated!**';
          }
        } catch {
          reply += '\n\n(Technical Error: Failed to apply plan update)';
        }
      }

      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Error connecting to coach. Please try again.' },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden">
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-full">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">AI Coach</h3>
              <p className="text-xs text-indigo-200 font-medium">Online • {goal}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`
                  max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-line
                  ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'}
                `}
              >
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

        <form
          onSubmit={handleSend}
          className="p-4 bg-white border-t border-slate-100 flex gap-2 z-10"
        >
          <input
            autoFocus
            type="text"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-base placeholder:text-slate-400"
            placeholder="Ask your coach..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
          >
            <Zap className="w-5 h-5 fill-current" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
