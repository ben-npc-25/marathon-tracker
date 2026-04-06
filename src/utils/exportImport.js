const safeName = (str) => str.replace(/[^a-z0-9]/gi, '_');

export const exportPlanToJSON = (plan, planLogs) => {
  const data = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    plan: {
      goal: plan.goal,
      title: plan.title,
      startDate: plan.startDate,
      raceDate: plan.raceDate,
    },
    days: Object.values(planLogs).sort((a, b) => a.id.localeCompare(b.id)),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(plan.title)}_${plan.raceDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportPlanToCSV = (plan, planLogs) => {
  const headers = ['Date', 'Planned Activity', 'Distance (km)', 'Duration', 'RPE', 'Notes', 'Coach Feedback'];

  const rows = Object.values(planLogs)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((log) => [
      log.id,
      log.plannedActivity || '',
      log.actualDistance || '',
      log.durationStr || '',
      log.rpe || '',
      (log.feeling || '').replace(/"/g, '""'),
      (log.coachFeedback || '').replace(/"/g, '""'),
    ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(plan.title)}_${plan.raceDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const parsePlanImport = (jsonString) => {
  const data = JSON.parse(jsonString);
  if (!data.plan || !Array.isArray(data.days)) {
    throw new Error('Invalid file format: missing plan or days fields.');
  }
  if (!data.plan.goal || !data.plan.startDate || !data.plan.raceDate) {
    throw new Error('Invalid file format: plan is missing required fields.');
  }
  return data;
};
