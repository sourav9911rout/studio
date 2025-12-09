
export type InfoWithReference = {
  value: string;
  references: string[];
};

export type DrugHighlight = {
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
