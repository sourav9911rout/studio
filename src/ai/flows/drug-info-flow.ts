
'use server';
/**
 * @fileOverview An AI flow to get detailed information about a specific drug.
 *
 * - getDrugInfo - A function that fetches pharmacological details for a given drug name.
 * - GetDrugInfoInput - The input type for the getDrugInfo function.
 * - GetDrugInfoOutput - The return type for the getDrugInfo function.
 */

import { ai, z } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

const GetDrugInfoInputSchema = z.object({
  drugName: z.string().describe('The name of the drug to look up.'),
  userApiKey: z.string().optional().describe('An optional user-provided API key to bypass environment limits.'),
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
  offLabelUse: z.object({
    value: z.string(),
    references: z.array(z.string().url()),
  }),
  funFact: z.string(),
});
export type GetDrugInfoOutput = z.infer<typeof GetDrugInfoOutputSchema>;

const SYSTEM_PROMPT = `You are an expert pharmacologist. Provide accurate and concise information for the requested drug.

For the 'offLabelUse' field, provide the text description in the 'value' property and a list of source URLs in the 'references' property.
For all other fields, provide a simple string value.

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
- Off Label Use (with value and references)
- Fun Fact`;

export async function getDrugInfo(input: GetDrugInfoInput): Promise<GetDrugInfoOutput> {
  // If a user API key is provided, we use a local Genkit instance to bypass global key limits/leaks
  if (input.userApiKey) {
    const localAi = genkit({
      plugins: [googleAI({ apiKey: input.userApiKey })],
      model: 'googleai/gemini-2.5-flash',
    });

    const response = await localAi.generate({
      system: SYSTEM_PROMPT,
      prompt: `Provide details for the drug: ${input.drugName}`,
      output: { schema: GetDrugInfoOutputSchema },
    });

    if (!response.output) {
      throw new Error('Failed to get drug information using the provided API key.');
    }
    return response.output;
  }

  // Otherwise use the default registered flow
  return getDrugInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getDrugInfoPrompt',
  input: { schema: GetDrugInfoInputSchema },
  output: { schema: GetDrugInfoOutputSchema },
  system: SYSTEM_PROMPT,
  prompt: `Provide details for the drug: {{drugName}}`,
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
