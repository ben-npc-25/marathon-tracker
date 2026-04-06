import { GEMINI_API_KEY } from '../firebase-config';
import { dateToISO } from './dates';

export const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const getPlanSchema = () => ({
  type: 'ARRAY',
  description: 'A chronological list of training activities.',
  items: {
    type: 'OBJECT',
    properties: {
      date: { type: 'STRING', description: 'Date in YYYY-MM-DD format.' },
      plannedActivity: { type: 'STRING', description: 'The planned workout.' },
    },
    required: ['date', 'plannedActivity'],
  },
});

export const generateTrainingPlan = async (
  goal,
  startDate,
  raceDate,
  existingLog = [],
  isAdjustment = false,
) => {
  const race = new Date(raceDate);
  const today = new Date();
  const generationStartDate = isAdjustment ? dateToISO(today) : startDate;

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
    const logSummary = existingLog
      .map(
        (log) =>
          `${log.date}: Planned "${log.plannedActivity}" -> Actual: ${log.actualDistance}km (${log.durationStr}), RPE ${log.rpe}, Notes: ${log.feeling}`,
      )
      .join('\n');

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
      responseMimeType: 'application/json',
      responseSchema: getPlanSchema(),
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`API Request Failed: ${response.status}`);

    const result = await response.json();
    const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonString) throw new Error('No JSON returned');

    const cleanJsonString = jsonString.replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
};

export const analyzeLog = async (plannedLog, actualFormData, currentGoal) => {
  const userPrompt = `Planned: "${plannedLog.plannedActivity}". Actual: ${actualFormData.actualDistance}km in ${actualFormData.durationStr}, RPE ${actualFormData.rpe}/10. Notes: "${actualFormData.feeling}". Goal: "${currentGoal}". Analyze performance.`;
  const systemInstruction =
    'You are a running coach. Provide concise feedback (max 3 sentences) and one tip.';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
      }),
    });
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || 'No feedback generated.';
  } catch {
    return 'Error getting analysis.';
  }
};
