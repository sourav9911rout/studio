'use server';
/**
 * @fileOverview An AI flow to generate an infographic for a drug.
 *
 * - generateInfographic - A function that creates a visual infographic from drug data.
 * - GenerateInfographicInput - The input type for the generateInfographic function.
 * - GenerateInfographicOutput - The return type for the generateInfographic function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Using a subset of fields that are most relevant for a visual summary.
const GenerateInfographicInputSchema = z.object({
  drugName: z.string(),
  drugClass: z.string(),
  mechanism: z.string(),
  uses: z.string(),
  sideEffects: z.string(),
});
export type GenerateInfographicInput = z.infer<typeof GenerateInfographicInputSchema>;

const GenerateInfographicOutputSchema = z.object({
  imageUrl: z.string().describe('The Base64 data URI of the generated infographic image.'),
});
export type GenerateInfographicOutput = z.infer<typeof GenerateInfographicOutputSchema>;

export async function generateInfographic(input: GenerateInfographicInput): Promise<GenerateInfographicOutput> {
  return generateInfographicFlow(input);
}

const generateInfographicFlow = ai.defineFlow(
  {
    name: 'generateInfographicFlow',
    inputSchema: GenerateInfographicInputSchema,
    outputSchema: GenerateInfographicOutputSchema,
  },
  async (input) => {
    const prompt = `Generate a visually appealing and informative infographic for a drug.
    The infographic should be clean, professional, and suitable for medical students.
    Use clear icons and a structured layout to present the information.
    Do not include any text that says "infographic".
    The image should be in a vertical, portrait orientation.

    Key information to include:
    - **Drug Name (Title):** ${input.drugName}
    - **Drug Class:** ${input.drugClass}
    - **Mechanism of Action:** Briefly summarize: ${input.mechanism}
    - **Common Uses:** List key uses: ${input.uses}
    - **Key Side Effects:** List the most important side effects: ${input.sideEffects}

    Design Style: Modern, flat design with a color palette suitable for a medical context (e.g., blues, greens, teals). Ensure text is legible.
    `;

    const { media } = await ai.generate({
        model: 'googleai/imagen-4.0-fast-generate-001',
        prompt: prompt,
        config: {
            aspectRatio: '9:16', // Portrait aspect ratio
        }
    });

    if (!media || !media.url) {
      throw new Error('Failed to generate infographic image.');
    }

    return { imageUrl: media.url };
  }
);
