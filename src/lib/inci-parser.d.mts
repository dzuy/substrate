export function key(value: string): string;
export function parseIngredients(raw: string): { reason: string | null; items: { name: string; concentration: number | null; section: string; order: number }[] };
