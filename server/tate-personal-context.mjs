const string = { type: 'string' };
const page = { type: 'integer', minimum: 1, maximum: 1000 };
const tool = (name, description, properties = {}) => ({ type: 'function', name, description, strict: true, parameters: { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) } });
export const personalTools = [
  tool('my_profile', 'Read the signed-in customer’s saved profile: goals, skin history, sensitivity, lifestyle and questionnaire. Retrieve when personalizing advice.'),
  tool('my_wardrobe', 'Read products the signed-in customer owns, including active, paused and finished status, routine timing and notes. Paginated with exact total. These are owned products, not catalog recommendations.', { page }),
  tool('my_reports', 'List the signed-in customer’s saved reports, newest first, with exact total count, dates, summaries and concerns. Use before answering how many reports, latest report, or change over time.', { page }),
  tool('my_report_details', 'Read a specific saved report’s sections, ingredient connections, recommendations and assessment answers. First use my_reports to discover its ID. Photos are not included.', { id: string }),
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createPersonalContext({ database, userId }) {
  return async (name, args) => {
    if (!uuid.test(userId)) throw new Error('Verified account required');
    // Account identity comes only from the verified bearer token, never tool arguments.
    const owner = { user_id: 'eq.' + userId };
    if (name === 'my_profile') {
      const rows = await database('profiles', { id: 'eq.' + userId, select: 'display_name,age_range,skin_type,sensitivity_level,skin_goals,known_triggers,skin_context_note,profile_data,updated_at', limit: '1' });
      return { profile: rows[0] ?? null, note: 'Self-reported profile, not a diagnosis. Empty fields mean unknown.' };
    }
    if (name === 'my_report_details') {
      if (!uuid.test(args.id)) throw new Error('Invalid report ID');
      const rows = await database('skin_reports', { ...owner, id: 'eq.' + args.id, select: 'id,created_at,simulated_unlocked,title:payload->>title,summary:payload->>summary,concerns:payload->concerns,photoLimitations:payload->photoLimitations,answers:payload->answers,sections:payload->sections', limit: '1' });
      return rows.length ? { report: rows[0], note: 'Historical report at created_at; visible photo observations are not a diagnosis. Assessment answers are historical, not necessarily the current profile.' } : { error: 'Report not found in your saved reports. It may have been deleted or not synced.' };
    }
    if (!Number.isInteger(args.page) || args.page < 1 || args.page > 1000) throw new Error('Invalid page');
    const paging = { limit: '20', offset: String((args.page - 1) * 20) };
    if (name === 'my_reports') {
      const { rows, total } = await database('skin_reports', { ...owner, ...paging, select: 'id,created_at,simulated_unlocked,title:payload->>title,summary:payload->>summary,concerns:payload->concerns', order: 'created_at.desc,id' }, undefined, true);
      return { reports: rows, total, page: args.page, has_more: total == null ? null : args.page * 20 < total, note: 'Count of currently saved cloud reports, excluding deleted reports. Device-only reports are unavailable. Read my_report_details for full contents; do not infer changes from counts alone.' };
    }
    if (name === 'my_wardrobe') {
      const { rows, total } = await database('user_wardrobe_items', { ...owner, ...paging, select: 'id,product_id,status,notes,added_at,routine_timing,frequency,routine_role,avoid_when_irritated,product:products(id,name,category,formula_status,brand:brands(name),product_ingredients(ingredient_order,ingredient:ingredients(id,name,inci_name)))', order: 'added_at.desc,id' }, undefined, true);
      return { items: rows, total, page: args.page, has_more: total == null ? null : args.page * 20 < total, note: 'Customer-owned product records, including unpublished wardrobe references. Only customer-facing formula fields are included. Paused and finished products are not an active routine. Missing linked ingredients do not establish absence.' };
    }
    return { error: 'Unknown personal context tool.' };
  };
}
