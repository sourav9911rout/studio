
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

// The output should match the fields we want to populate in the form.
const GetDrugInfoOutputSchema = z.object({
  drugName: z.string(),
  drugClass: z.string(),
  mechanism: z.string(),
  uses: z.string(),
  sideEffects: z.string(),
  routeOfAdministration: z.string(),
  dose: z.string(),
  dosageForm: z.string(),
  halfLife: z.string(),
  clinicalUses: z.string(),
  contraindication: z.string(),
  offLabelUse: z.string(),
  funFact: z.string(),
});
export type GetDrugInfoOutput = z.infer<typeof GetDrugInfoOutputSchema>;

export async function getDrugInfo(input: GetDrugInfoInput): Promise<GetDrugInfoOutput> {
  return getDrugInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getDrugInfoPrompt',
  input: { schema: GetDrugInfoInputSchema },
  output: { schema: GetDrugInfoOutputSchema },
  prompt: `You are an expert pharmacologist. Provide accurate and concise information for the drug named "{{drugName}}".

Your response must be of high quality and accuracy, suitable for medical professionals.
Return only the requested information as a JSON object with the specified keys. Do not include any extra text or explanations.

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
- Fun Fact`,
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
