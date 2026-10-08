import type { Decision } from "../packages/ingredient-engine/src/contracts";
export const ingredientIntro: string;
export function clarifyReport<
  T extends {
    decision?: Pick<Decision, "cards" | "states">;
    sections: {
      id: string;
      title: string;
      intro: string;
      items: {
        label: string;
        body: string;
        ingredientId?: string;
        evidence?: string;
        detail?: string;
        clarifications?: { label: string; body: string }[];
      }[];
    }[];
  },
>(report: T): T;
