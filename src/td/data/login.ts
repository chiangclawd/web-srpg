/**
 * 每日登入獎勵：連續登入 7 天一輪，獎勵遞增；中斷一天就從第 1 天重來。
 */
export const LOGIN_GEMS = [5, 5, 10, 10, 15, 15, 30];

export interface LoginState {
  /** 上次領取的日期（dailyKey 格式） */
  last: string;
  /** 上次領的是第幾天（1~7） */
  streak: number;
}

/** 今天可領的獎勵；今天已經領過回傳 null */
export function loginReward(state: LoginState | undefined, today: string, yesterday: string): { day: number; gems: number } | null {
  if (state?.last === today) return null;
  const day = state && state.last === yesterday ? (state.streak % LOGIN_GEMS.length) + 1 : 1;
  return { day, gems: LOGIN_GEMS[day - 1] };
}

/** 前一天的日期鍵值（用本地日期往回一天，避開夏令時間的 23／25 小時） */
export function previousDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
}
