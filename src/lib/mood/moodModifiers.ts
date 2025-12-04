import { MoodId } from "./types";

export const moodModifiers: Record<MoodId, string> = {
  friendly: `
Tone: warm, friendly, and helpful.
- Use everyday language.
- Be positive and encouraging.
- Avoid jargon.
`,

  urgent: `
Tone: urgent, direct, and action-oriented.
- Use short sentences.
- Emphasize time sensitivity without sounding desperate.
- Drive toward a clear next step.
`,

  calm: `
Tone: calm, reassuring, and emotionally steady.
- De-escalate tension.
- Show understanding and empathy.
- Avoid aggressive or pushy language.
`,

  precision: `
Tone: precise, expert, and detail-focused.
- Use clear structure and specific details.
- Highlight numbers, ROI, and concrete benefits.
- Avoid fluff; be concise but complete.
`,

  insight: `
Tone: strategic, consultative, and insight-driven.
- Offer perspective and recommendations.
- Frame challenges and opportunities.
- Make the reader feel guided by an expert advisor.
`
};