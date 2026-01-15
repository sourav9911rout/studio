
export type InfoWithReference = {
  value: string;
  references: string[];
};

export type DrugHighlight = {
  id: string; // Unique ID for each drug within a day
  drugName: string;
  drugClass: string;
  mechanism: string;
  uses: string;
  sideEffects: string;
  routeOfAdministration: string;
  dose: string;
  dosageForm: string;
  halfLife: string;
  clinicalUses: string;
  contraindication: string;
  offLabelUse: InfoWithReference;
  funFact: string;
};

export type DailyHighlight = {
  date: string; // YYYY-MM-DD
  drugs: DrugHighlight[];
};
