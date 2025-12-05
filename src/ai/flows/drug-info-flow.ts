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
import { DrugHighlight } from '@/lib/types';

// Omit the 'id' field for the AI generation part as it's not needed.
// We can reuse the DrugHighlight type and remove what's not necessary.
const GetDrugInfoInputSchema = z.object({
  drugName: z.string().describe('The name of the drug to look up.'),
});
export type GetDrugInfoInput = z.infer<typeof GetDrugInfoInputSchema>;

// The output should match the fields we want to populate in the form.
const GetDrugInfoOutputSchema = z.object({
  drugClass: z.string().describe('The pharmacological class of the drug.'),
  mechanism: z
    .string()
    .describe('The mechanism of action of the drug.'),
  uses: z.string().describe('Common clinical uses of the drug.'),
  sideEffects: z.string().describe('Common side effects of the drug.'),
  funFact: z.string().describe('An interesting or fun fact about the drug.'),
  routeOfAdministration: z.string().describe("The route of administration for the drug."),
  dose: z.string().describe("The typical dose of the drug."),
  dosageForm: z.string().describe("The available dosage forms of the drug."),
  halfLife: z.string().describe("The half-life of the drug."),
  clinicalUses: z.string().describe("The clinical uses of the drug."),
  contraindication: z.string().describe("Contraindications for the drug."),
  offLabelUse: z.string().describe("Common off-label uses for the drug."),
});
export type GetDrugInfoOutput = z.infer<typeof GetDrugInfoOutputSchema>;


export async function getDrugInfo(input: GetDrugInfoInput): Promise<GetDrugInfoOutput> {
  return getDrugInfoFlow(input);
}


const prompt = ai.definePrompt({
  name: 'getDrugInfoPrompt',
  input: { schema: GetDrugInfoInputSchema },
  output: { schema: GetDrugInfoOutputSchema },
  prompt: `You are an expert pharmacologist.
For the drug named "{{drugName}}", provide the following information.
Ensure the output is in the requested JSON format.

- Drug Class
- Mechanism of Action
- Common Uses
- Side Effects
- A Fun Fact
- Route of Administration
- Dose
- Dosage Form
- Half-life
- Clinical uses
- Contraindication
- Off Label Use`,
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
