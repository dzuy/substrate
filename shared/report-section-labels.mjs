const labels = {
  signature: "Your Skin",
  context: "Context",
  observations: "Observations",
  drivers: "Factors",
  ingredients: "Ingredients",
  wardrobe: "Your Wardrobe",
  routine: "Routine",
  products: "Products",
  safety: "Safety",
  lifestyle: "Lifestyle",
  biology: "Biology",
  next: "Your Plan",
};
export function reportSectionLabel(section, index) {
  return `${String(index + 1).padStart(2, "0")} ${labels[section.id] || section.title}`;
}
