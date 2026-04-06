// eslint-disable-next-line no-unused-vars
import React from 'react';
import { Trophy, CheckCircle, Plus } from 'lucide-react';
import { getDaysArray, getMonthYear, dateToISO, dayNames } from '../utils/dates';

const CalendarView = ({ currentPlan, planLogs, onDayClick }) => {
  if (!currentPlan) return null;

  const allDates = getDaysArray(currentPlan.startDate, currentPlan.raceDate);
  const today = dateToISO(new Date());

  const months = {};
  allDates.forEach((date) => {
    const { key, label } = getMonthYear(date);
    if (!months[key]) months[key] = { label, days: [] };
    months[key].days.push(date);
  });

  return (
    <div className="space-y-10">
      {Object.values(months).map((month, mIndex) => (
        <div key={mIndex}>
          {/* Month header */}
          <div className="flex items-center gap-3 mb-4 sticky top-0 bg-gray-50 py-2 z-10">
            <h3 className="text-base font-bold text-gray-800">{month.label}</h3>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">
              {month.days.filter(d => planLogs[d]?.actualDistance && parseFloat(planLogs[d].actualDistance) > 0).length}
              /{month.days.length} logged
            </span>
          </div>

          {/* Day headers - desktop only */}
          <div className="hidden md:grid grid-cols-7 gap-2 mb-1">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-1.5 sm:gap-2">
            {/* Offset for first day */}
            {Array(new Date(month.days[0]).getDay()).fill(null).map((_, i) => (
              <div key={`empty-${i}`} className="hidden md:block" />
            ))}

            {month.days.map((date) => {
              const log = planLogs[date];
              const isRaceDay = date === currentPlan.raceDate;
              const isToday = date === today;
              const isPast = date < today;
              const isCompleted = log && log.actualDistance && parseFloat(log.actualDistance) > 0;
              const hasPlannedActivity = !!log?.plannedActivity;

              const activityLower = log?.plannedActivity?.toLowerCase() || '';
              const isRest =
                activityLower === 'rest' ||
                activityLower.startsWith('rest ') ||
                activityLower.startsWith('rest/');

              const dayNum = date.split('-')[2];
              const dayOfWeek = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

              // Card style
              let cardStyle = '';
              let dateColor = 'text-gray-400';

              if (isRaceDay) {
                cardStyle = 'bg-gradient-to-br from-amber-50 to-yellow-100 border-yellow-300 ring-2 ring-yellow-400 ring-offset-1';
                dateColor = 'text-yellow-700';
              } else if (isCompleted) {
                cardStyle = 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200';
                dateColor = 'text-emerald-700';
              } else if (isToday) {
                cardStyle = 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-300 ring-2 ring-indigo-400 ring-offset-1';
                dateColor = 'text-indigo-600';
              } else if (isRest) {
                cardStyle = 'bg-gray-50 border-gray-100 opacity-50';
              } else if (!log || !hasPlannedActivity) {
                cardStyle = isPast ? 'bg-gray-50 border-gray-100 opacity-40' : 'bg-white border-gray-100';
              } else {
                cardStyle = 'bg-white border-gray-200 hover:border-indigo-200';
              }

              // Activity text to show
              let activityText = null;
              let activityColor = 'text-gray-700';

              if (isRaceDay && !hasPlannedActivity) {
                activityText = '🏁 RACE DAY';
                activityColor = 'text-yellow-800 font-black';
              } else if (hasPlannedActivity) {
                activityText = log.plannedActivity;
                activityColor = isRest ? 'text-gray-400' : isCompleted ? 'text-emerald-800' : 'text-gray-700';
              } else if (isCompleted) {
                // Has distance but no planned activity — show what was actually done
                activityText = `Ran ${parseFloat(log.actualDistance).toFixed(1)} km`;
                activityColor = 'text-emerald-700 font-semibold';
              } else {
                activityText = null;
              }

              return (
                <div
                  key={date}
                  onClick={() => onDayClick({ date, ...log, goal: currentPlan.goal })}
                  className={`
                    relative border rounded-xl cursor-pointer transition-all duration-150
                    hover:shadow-md hover:scale-[1.01] active:scale-[0.99]
                    min-h-[64px] md:min-h-[88px]
                    flex flex-row md:flex-col p-2.5
                    gap-2.5 md:gap-0
                    ${cardStyle}
                  `}
                >
                  {/* Date number */}
                  <div className="flex md:flex-row flex-col items-center md:items-start md:justify-between md:mb-1.5 flex-shrink-0 w-10 md:w-full">
                    <div className="flex flex-col items-center md:block">
                      <span className="md:hidden text-[9px] font-bold text-gray-400 uppercase">{dayOfWeek}</span>
                      <span className={`text-sm font-bold ${dateColor} ${isToday ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs' : ''}`}>
                        {dayNum}
                      </span>
                    </div>
                    {isRaceDay && <Trophy className="w-3.5 h-3.5 text-yellow-500 hidden md:block" />}
                  </div>

                  {/* Activity text */}
                  <div className="flex-1 min-w-0">
                    {activityText ? (
                      <p className={`text-xs leading-snug line-clamp-3 ${activityColor}`}>
                        {activityText}
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-300 italic">
                        {isPast ? 'Not logged' : 'Tap to add'}
                      </p>
                    )}

                    {/* Distance badge on completed days */}
                    {isCompleted && hasPlannedActivity && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                        {parseFloat(log.actualDistance).toFixed(1)} km
                      </span>
                    )}
                  </div>

                  {/* Status indicators */}
                  <div className="md:absolute md:top-2 md:right-2 flex-shrink-0 self-start">
                    {isCompleted && !isRaceDay ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : !log && !isPast && !isRaceDay ? (
                      <Plus className="w-3.5 h-3.5 text-gray-200" />
                    ) : null}
                    {isRaceDay && <Trophy className="w-4 h-4 text-yellow-500 md:hidden" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CalendarView;
