type NutritionPanelProps = {
  nutrition: {
    calorieTarget: string;
    proteinTargetGrams: number;
    carbohydrateGuidance: string;
    recommended: Array<{ name: string; calories: number; proteinGrams: number }>;
    caution: Array<{ name: string; calories: number; fatGrams: number }>;
  } | null;
};

export function NutritionPanel({ nutrition }: NutritionPanelProps) {
  if (!nutrition) {
    return <section className="surface empty-state">Generate a plan to see nutrition targets and menu recommendations.</section>;
  }

  return (
    <section className="surface panel">
      <div className="panel-heading">
        <div>
          <h2>Nutrition</h2>
          <p className="page-subtitle">{nutrition.carbohydrateGuidance}</p>
        </div>
        <span className="status status-positive">{nutrition.proteinTargetGrams}g protein</span>
      </div>

      <div className="nutrition-sections">
        <div>
          <h3 className="section-title section-title-positive">Recommended menu choices</h3>
          <ul className="nutrition-list">
            {nutrition.recommended.map((item) => (
              <li className="nutrition-item" key={item.name}>
                <span>{item.name}</span>
                <span className="muted">
                  {item.calories} kcal · {item.proteinGrams}g protein
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="section-title section-title-warn">Use caution</h3>
          <ul className="nutrition-list">
            {nutrition.caution.map((item) => (
              <li className="nutrition-item" key={item.name}>
                <span>{item.name}</span>
                <span className="muted">
                  {item.calories} kcal · {item.fatGrams}g fat
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
