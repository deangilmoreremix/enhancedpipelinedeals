/** Win rate (percent) = won / (won + lost). Open deals do not count; 0 when nothing has closed. Single definition used by every "Win Rate" widget. */
export const winRatePercent = (won: number, lost: number): number => (won + lost > 0 ? (won / (won + lost)) * 100 : 0);
