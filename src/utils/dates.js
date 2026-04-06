export const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const dateToISO = (date) => date.toISOString().split('T')[0];

export const getDaysArray = (start, end) => {
  const arr = [];
  for (let dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
    arr.push(dateToISO(new Date(dt)));
  }
  return arr;
};

export const getMonthYear = (isoDate) => {
  const date = new Date(isoDate + 'T00:00:00');
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
  };
};
