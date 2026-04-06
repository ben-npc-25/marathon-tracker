import { useState, useEffect } from 'react';
import { db } from '../firebase-config';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { getSafeAppId } from '../config';
import { generateTrainingPlan } from '../utils/gemini';
import { parsePlanImport } from '../utils/exportImport';

const getPlansRef = (uid) =>
  collection(db, 'artifacts', getSafeAppId(), 'users', uid, 'plans');

const getDaysRef = (uid, planId) =>
  collection(db, 'artifacts', getSafeAppId(), 'users', uid, 'plans', planId, 'days');

const getPlanDoc = (uid, planId) =>
  doc(db, 'artifacts', getSafeAppId(), 'users', uid, 'plans', planId);

const getDayDoc = (uid, planId, date) =>
  doc(db, 'artifacts', getSafeAppId(), 'users', uid, 'plans', planId, 'days', date);

export function usePlans(user) {
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planLogs, setPlanLogs] = useState({});
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch plans list
  useEffect(() => {
    if (!user) return;
    const q = query(getPlansRef(user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPlans(fetched);
      if (fetched.length > 0 && !currentPlanId) {
        setCurrentPlanId(fetched[0].id);
      } else if (fetched.length === 0) {
        setCurrentPlanId(null);
      }
    });
    return () => unsubscribe();
  }, [user, currentPlanId]);

  // Fetch current plan details & logs
  useEffect(() => {
    if (!user || !currentPlanId) {
      setCurrentPlan(null);
      setPlanLogs({});
      return;
    }
    const selected = plans.find((p) => p.id === currentPlanId) || null;
    setCurrentPlan(selected);

    const unsubscribe = onSnapshot(getDaysRef(user.uid, currentPlanId), (snapshot) => {
      const logs = {};
      snapshot.docs.forEach((d) => {
        logs[d.id] = { id: d.id, ...d.data() };
      });
      setPlanLogs(logs);
    });
    return () => unsubscribe();
  }, [user, currentPlanId, plans]);

  const handleCreatePlan = async ({ goal, startDate, raceDate }) => {
    if (!user) return;
    setIsCreatingPlan(true);
    setError(null);
    try {
      const newPlanRef = await addDoc(getPlansRef(user.uid), {
        goal,
        title: goal,
        startDate,
        raceDate,
        createdAt: serverTimestamp(),
      });

      const generatedPlan = await generateTrainingPlan(goal, startDate, raceDate);
      if (generatedPlan) {
        const batch = writeBatch(db);
        generatedPlan.forEach((day) => {
          batch.set(doc(getDaysRef(user.uid, newPlanRef.id), day.date), {
            ...day,
            actualDistance: '',
            durationStr: '',
            feeling: '',
            rpe: 5,
            coachFeedback: '',
          });
        });
        await batch.commit();
      }

      setCurrentPlanId(newPlanRef.id);
      return true;
    } catch (e) {
      console.error('Error creating plan:', e);
      setError('Failed to create plan. Please try again.');
      return false;
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!user || !currentPlanId) return;
    try {
      const batch = writeBatch(db);
      Object.keys(planLogs).forEach((date) => {
        batch.delete(getDayDoc(user.uid, currentPlanId, date));
      });
      batch.delete(getPlanDoc(user.uid, currentPlanId));
      await batch.commit();
      setCurrentPlanId(null);
    } catch (e) {
      console.error('Error deleting plan:', e);
      setError('Failed to delete plan. Please try again.');
    }
  };

  const handleSaveLog = async (updatedLog) => {
    if (!user || !currentPlanId) return;
    const logRef = getDayDoc(user.uid, currentPlanId, updatedLog.date);
    await setDoc(logRef, updatedLog, { merge: true });
  };

  const handleUpdateTitle = async (newTitle) => {
    if (!user || !currentPlanId) return;
    await setDoc(getPlanDoc(user.uid, currentPlanId), { title: newTitle }, { merge: true });
  };

  const handleAdjustPlan = async () => {
    if (!user || !currentPlan) return;
    setIsAdjusting(true);
    setError(null);
    try {
      const completedLogs = Object.values(planLogs).filter(
        (l) => l.actualDistance && parseFloat(l.actualDistance) > 0,
      );
      const generatedPlan = await generateTrainingPlan(
        currentPlan.goal,
        currentPlan.startDate,
        currentPlan.raceDate,
        completedLogs,
        true,
      );

      if (generatedPlan) {
        const batch = writeBatch(db);
        generatedPlan.forEach((day) => {
          batch.set(doc(getDaysRef(user.uid, currentPlanId), day.date), day, { merge: true });
        });
        await batch.commit();
      } else {
        setError('Failed to adjust plan. Please try again.');
      }
    } catch (e) {
      console.error('Error adjusting plan:', e);
      setError('Failed to adjust plan. Please try again.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleChatUpdatePlan = async (newDays) => {
    if (!user || !currentPlanId) return;
    try {
      const batch = writeBatch(db);
      newDays.forEach((day) => {
        if (day.date && day.plannedActivity) {
          batch.set(
            doc(getDaysRef(user.uid, currentPlanId), day.date),
            { date: day.date, plannedActivity: day.plannedActivity },
            { merge: true },
          );
        }
      });
      await batch.commit();
    } catch (e) {
      console.error('Error updating plan from chat:', e);
      setError('Failed to update plan from chat.');
    }
  };

  const handleImportPlan = async (jsonString) => {
    if (!user) return;
    setIsCreatingPlan(true);
    setError(null);
    try {
      const { plan, days } = parsePlanImport(jsonString);

      const newPlanRef = await addDoc(getPlansRef(user.uid), {
        goal: plan.goal,
        title: `${plan.title} (Imported)`,
        startDate: plan.startDate,
        raceDate: plan.raceDate,
        createdAt: serverTimestamp(),
      });

      if (days.length > 0) {
        const batch = writeBatch(db);
        days.forEach((day) => {
          if (day.id) {
            batch.set(doc(getDaysRef(user.uid, newPlanRef.id), day.id), day);
          }
        });
        await batch.commit();
      }

      setCurrentPlanId(newPlanRef.id);
      return true;
    } catch (e) {
      console.error('Error importing plan:', e);
      setError(e.message || 'Failed to import plan.');
      return false;
    } finally {
      setIsCreatingPlan(false);
    }
  };

  return {
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
  };
}
