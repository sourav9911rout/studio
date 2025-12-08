

export type InfoWithReference = {
  value: string;
  references: string[];
};

export type DrugHighlight = {
  drugName: InfoWithReference;
  drugClass: InfoWithReference;
  mechanism: InfoWithReference;
  uses: InfoWithReference;
  sideEffects: InfoWithReference;
  routeOfAdministration: InfoWithReference;
  dose: InfoWithReference;
  dosageForm: InfoWithReference;
  halfLife: InfoWithReference;
  clinicalUses: InfoWithReference;
  contraindication: InfoWithReference;
  offLabelUse: InfoWithReference;
  funFact: InfoWithReference;
};
