
'use server';
/**
 * @fileOverview An AI flow to get detailed information about a specific drug, including references.
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
    value: z.string().describe("The textual value of the information."),
    references: z.array(z.string().url()).describe("A list of URLs pointing to the sources of the information. Must be a valid URL.")
});

// The output should match the fields we want to populate in the form.
const GetDrugInfoOutputSchema = z.object({
  drugName: InfoWithReferenceSchema,
  drugClass: InfoWithReferenceSchema,
  mechanism: InfoWithReferenceSchema,
  uses: InfoWithReferenceSchema,
  sideEffects: InfoWithReferenceSchema,
  routeOfAdministration: InfoWithReferenceSchema,
  dose: InfoWithReferenceSchema,
  dosageForm: InfoWithReferenceSchema,
  halfLife: InfoWithReferenceSchema,
  clinicalUses: InfoWithReferenceSchema,
  contraindication: InfoWithReferenceSchema,
  offLabelUse: InfoWithReferenceSchema,
  funFact: InfoWithReferenceSchema,
});
export type GetDrugInfoOutput = z.infer<typeof GetDrugInfoOutputSchema>;

export async function getDrugInfo(input: GetDrugInfoInput): Promise<GetDrugInfoOutput> {
  return getDrugInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getDrugInfoPrompt',
  input: { schema: GetDrugInfoInputSchema },
  output: { schema: GetDrugInfoOutputSchema },
  prompt: `You are an expert pharmacologist with a strict requirement for citing sources. Provide accurate, concise, and well-referenced information for the drug named "{{drugName}}".

For each field below, you MUST provide the information as a JSON object with two keys: "value" (a string containing the information) and "references" (an array of source URLs).
- Every piece of information must be backed by at least one verifiable, high-quality source URL (e.g., from reputable medical journals, government health agencies, or university websites).
- The 'value' for the drug name should be the standardized common name.
- The 'Fun Fact' must be an interesting, verifiable detail, not a general summary, and it must also be referenced.

Your response must be of high quality and accuracy, suitable for medical professionals.

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
