import AsyncStorage from '@react-native-async-storage/async-storage';

function keyForPlan(planId: string) {
  return `steady:resume-week:${planId}`;
}

export async function getResumeWeekOverride(planId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(keyForPlan(planId));
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function setResumeWeekOverride(planId: string, weekNumber: number): Promise<void> {
  await AsyncStorage.setItem(keyForPlan(planId), String(weekNumber));
}

export async function clearResumeWeekOverride(planId: string): Promise<void> {
  await AsyncStorage.removeItem(keyForPlan(planId));
}
