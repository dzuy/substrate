// Explicit prototype interpretation; not original workbook rows or clinical approval.
export const ruleVersion = 'full-prototype-policy-v1';
export const inferredEdges: Array<[string,string,number]> = [
 ['C_MELASMA','P_PIGMENT',3],['C_DEHYDRATION','P_HYDR',3],['C_DEHYDRATION','P_BARRIER',2],
 ['C_OIL','P_SEBUM',3],['C_TEXTURE','P_KERATIN',3],['C_TEXTURE','P_HYDR',2],
 ['C_LAXITY','P_ECM',2],['C_LAXITY','P_ADIPOSE',3],['C_VOLUME','P_ADIPOSE',3],
 ['C_SCAR','P_WOUND',3],['C_SCAR','P_ECM',2],['C_BRUISE','P_VASC',3],
];
export const inferredIngredientEdges: Array<[string,string]> = [['P_PIGMENT','I_AZA'],['P_PIGMENT','I_RET'],['P_PIGMENT','I_VITC'],['P_PIGMENT','I_NIA']];
export const visualConditions: Record<string,string[]> = {
 acne:['C_ACNE'],redness:['C_ROSACEA'],texture:['C_TEXTURE'],pore:['C_TEXTURE'],pigmentation:['C_PIH'],
 flaking:['C_BARRIER'],fine_lines:['C_WRINKLE'],residual_marks:['C_PIH'],
};
export const goalConditions: Record<string,string[]> = {Breakouts:['C_ACNE'],Redness:['C_ROSACEA'],'Dark marks':['C_PIH'],'Texture / pores':['C_TEXTURE'],Dryness:['C_DEHYDRATION'],'Fine lines':['C_WRINKLE'],'Maintain my skin':['C_GLOW']};
export const sourceLocation = (row: { _source: { sheet:string;row:number } }) => `${row._source.sheet}!${row._source.row}`;

// Endpoint vocabulary is an explicit adapter, never an LLM-inferred evidence transfer.
export const endpointTerms: Record<string,string[]> = {
 C_ACNE:['acne','comedone'],C_ROSACEA:['rosacea','erythema','redness'],C_PIH:['post-inflammatory hyperpigmentation','pih'],C_MELASMA:['melasma'],
 C_BARRIER:['barrier','transepidermal water loss'],C_DEHYDRATION:['hydration','water content'],C_OIL:['sebum','oiliness'],C_TEXTURE:['texture','pore'],
 C_PHOTOAGING:['photoaging','photodamage'],C_WRINKLE:['wrinkle','fine line'],C_LAXITY:['laxity'],C_VOLUME:['facial volume'],C_SCAR:['scar'],C_POSTPROC:['post-procedure','wound recovery'],C_BRUISE:['bruising'],C_GLOW:['hydration','even tone'],
};
