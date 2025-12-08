'use server';
/**
 * @fileOverview An AI flow to get detailed information about a specific drug.
 *
 * - getDrugInfo - A function that fetches pharmacological details for a given drug name.
 * - GetDrugInfoInput - The input type for the getDrugInfo function.
 * - GetDrugInfoOutput - The return type for the getDrugInfo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GetDrugInfoInputSchema = z.object({
  drugName: z.string().describe('The name of the drug to look up.'),
});
export type GetDrugInfoInput = z.infer<typeof GetDrugInfoInputSchema>;

const InfoWithReferenceSchema = z.object({
  value: z.string(),
  references: z.array(z.string()).describe('List of sources/references for this information. Should be valid URLs.'),
});

// The output should match the fields we want to populate in the form.
const GetDrugInfoOutputSchema = z.object({
  drugName: z.string().describe('The common name of the drug.'),
  drugClass: InfoWithReferenceSchema.describe('The pharmacological class of the drug.'),
  mechanism: InfoWithReferenceSchema.describe('The mechanism of action of the drug.'),
  uses: InfoWithReferenceSchema.describe('Common clinical uses of the drug.'),
  sideEffects: InfoWithReferenceSchema.describe('Common side effects of the drug.'),
  routeOfAdministration: InfoWithReferenceSchema.describe("The route of administration for the drug."),
  dose: InfoWithReferenceSchema.describe("The typical dose of the drug."),
  dosageForm: InfoWithReferenceSchema.describe("The available dosage forms of the drug."),
  halfLife: InfoWithReferenceSchema.describe("The half-life of the drug."),
  clinicalUses: InfoWithReferenceSchema.describe("The clinical uses of the drug."),
  contraindication: InfoWithReferenceSchema.describe("Contraindications for the drug."),
  offLabelUse: InfoWithReferenceSchema.describe("Common off-label uses for the drug."),
  funFact: InfoWithReferenceSchema.describe('An interesting fun fact about the drug.'),
});
export type GetDrugInfoOutput = z.infer<typeof GetDrugInfoOutputSchema>;

export async function getDrugInfo(input: GetDrugInfoInput): Promise<GetDrugInfoOutput> {
  return getDrugInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getDrugInfoPrompt',
  input: { schema: GetDrugInfoInputSchema },
  output: { schema: GetDrugInfoOutputSchema },
  prompt: `You are a highly-skilled and meticulous pharmacologist with a strong emphasis on evidence-based information. Your task is to provide accurate and verifiable pharmacological details for a given drug.

For the drug named "{{drugName}}", you must provide the following information. For each piece of information, you are required to provide:
1.  A 'value' containing the accurate information.
2.  An array of 'references', where each reference is a valid, specific URL that directly supports the provided value. Do not use general homepage URLs. The reference must point to the exact page where the information can be verified.

Your response must be of the highest quality and accuracy, suitable for medical professionals. If you cannot find a reliable source for a piece of information, state that the information is not available.

- Drug Name
- Drug Class
- Mechanism of Action
- Common Uses
- Side Effects
- Route of Administration
- Dose
- Dosage Form
- Half-life
- Clinical uses
- Contraindication
- Off Label Use
- Fun Fact (must be a fun fact or other interesting detail, not a general summary, but still requires a valid source).`,
});

const getDrugInfoFlow = ai.defineFlow(
  {
    name: 'getDrugInfoFlow',
    inputSchema: GetDrugInfoInputSchema,
    outputSchema: GetDrugInfoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to get drug information from AI.');
    }
    return output;
  }
);
