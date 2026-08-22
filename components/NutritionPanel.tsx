import React from "react";

type NutritionPanelProps = {
  nutrition: {
    calorieTarget: string;
    proteinTargetGrams: number;
    carbohydrateGuidance: string;
    recommended: Array<{ name: string; calories: number; proteinGrams: number }>;
    caution: Array<{ name: string; calories: number; fatGrams: number }>;
  } | null;
};

/**
 * Two layers with different prerequisites. The targets and the carbohydrate
 * guidance come from the goal and the training intensity, so they stand on
 * their own. The dish lists are picked out of an imported canteen menu and are
 * empty for an account with no meal menu connection, in which case they are
 * omitted rather than rendered as empty headings.
 */
export function NutritionPanel({ nutrition }: NutritionPanelProps) {
  if (!nutrition) {
    return <section className="surface empty-state">Generate a plan to see your nutrition targets.</section>;
  }

  const hasMenuChoices = nutrition.recommended.length > 0 || nutrition.caution.length > 0;

  return (
    <section className="surface panel">
      <div className="panel-heading">
        <div>
          <h2>Nutrition</h2>
          <p className="page-subtitle">{nutrition.carbohydrateGuidance}</p>
        </div>
        <span className="status status-positive">{nutrition.proteinTargetGrams}g protein</span>
      </div>

      <ul className="nutrition-list">
        <li className="nutrition-item">
          <span>Calories</span>
          <span className="muted">{nutrition.calorieTarget}</span>
        </li>
        <li className="nutrition-item">
          <span>Protein</span>
          <span className="muted">{nutrition.proteinTargetGrams}g per day</span>
        </li>
      </ul>

      {hasMenuChoices ? (
        <div className="nutrition-sections">
          {nutrition.recommended.length > 0 ? (
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
          ) : null}

          {nutrition.caution.length > 0 ? (
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
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
