import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json({ limit: '10mb' }));

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const dateToISO = (date) => date.toISOString().split('T')[0];

// Clean any accidental markdown code fences from Claude's JSON output
const parseJSON = (text) =>
  JSON.parse(text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim());

// --- Generate / Adjust Training Plan ---
app.post('/api/generate-plan', async (req, res) => {
  const { goal, startDate, raceDate, existingLog = [], isAdjustment = false } = req.body;

  const race = new Date(raceDate);
  const generationStart = isAdjustment ? dateToISO(new Date()) : startDate;
  const fourWeeks = new Date(generationStart);
  fourWeeks.setDate(fourWeeks.getDate() + 28);
  const endDate = dateToISO(fourWeeks < race ? fourWeeks : race);

  let system, prompt;

  if (!isAdjustment) {
    system = `You are a world-class marathon running coach.
Output ONLY a valid JSON array — no explanation, no markdown, no code fences.
Each element: {"date": "YYYY-MM-DD", "plannedActivity": "description"}
Use metric (km). Mix easy runs, tempo, intervals, long runs, and rest days appropriately.`;

    prompt = `Create a training plan from ${startDate} to ${endDate}.
Goal: ${goal}
Race date: ${raceDate}`;
  } else {
    const summary = existingLog
      .map((l) => `${l.date}: Planned "${l.plannedActivity}" → ${l.actualDistance}km, RPE ${l.rpe}/10. ${l.feeling}`)
      .join('\n');

    system = `You are an adaptive marathon coach. Review the athlete's logs and adjust their plan.
Output ONLY a valid JSON array — no explanation, no markdown, no code fences.
Each element: {"date": "YYYY-MM-DD", "plannedActivity": "description"}`;

    prompt = `Adjust the plan from ${generationStart} to ${endDate} based on these logs.
Goal: ${goal} | Race: ${raceDate}

Recent performance:
${summary}`;
  }

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8096,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json(parseJSON(msg.content[0].text));
  } catch (err) {
    console.error('generate-plan error:', err.message);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// --- Analyze a Single Workout ---
app.post('/api/analyze-log', async (req, res) => {
  const { plannedLog, actualFormData, currentGoal } = req.body;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: 'You are a running coach. Give concise, specific feedback in 2–3 sentences then one actionable tip. No bullet lists.',
      messages: [{
        role: 'user',
        content: `Goal: "${currentGoal}"
Planned: "${plannedLog.plannedActivity}"
Actual: ${actualFormData.actualDistance} km in ${actualFormData.durationStr}, RPE ${actualFormData.rpe}/10
Notes: "${actualFormData.feeling}"`,
      }],
    });

    res.json({ feedback: msg.content[0].text });
  } catch (err) {
    console.error('analyze-log error:', err.message);
    res.status(500).json({ error: 'Failed to analyze workout' });
  }
});

// --- Coach Chat ---
app.post('/api/chat', async (req, res) => {
  const { messages, currentPlan } = req.body;

  const planContext = currentPlan
    ? `\n\nCurrent plan: Goal "${currentPlan.goal}", starts ${currentPlan.startDate}, race ${currentPlan.raceDate}.
If the user asks to CHANGE the plan: explain briefly, then output the affected days as a JSON array wrapped EXACTLY like:
<<<PLAN_UPDATE>>> [{"date":"YYYY-MM-DD","plannedActivity":"..."},...] <<<PLAN_UPDATE>>>
Only include dates within the plan range. No markdown inside the delimiters.`
    : '';

  const system = `You are an expert running coach and training advisor.${planContext}
Be concise and direct. Only produce plan JSON when the user explicitly requests a schedule change.`;

  // Map frontend message format (role: 'model') → Anthropic format (role: 'assistant')
  const claudeMessages = messages.map((m) => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.text,
  }));

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: claudeMessages,
    });

    let reply = msg.content[0].text;
    let planUpdate = null;

    const match = reply.match(/<<<PLAN_UPDATE>>>([\s\S]*?)<<<PLAN_UPDATE>>>/);
    if (match?.[1]) {
      try {
        planUpdate = parseJSON(match[1]);
        reply = reply.replace(match[0], '').trim() + '\n\n✅ Plan updated!';
      } catch {
        // leave reply as-is if parsing fails
      }
    }

    res.json({ reply, planUpdate });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: 'Failed to connect to coach' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Claude API server listening on port ${PORT}`));
