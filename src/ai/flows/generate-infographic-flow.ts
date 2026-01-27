
'use server';
/**
 * @fileOverview An AI flow to generate an infographic for a specific drug.
 *
 * - generateInfographic - A function that creates an infographic image from drug data.
 * - GenerateInfographicInput - The input type for the generateInfographic function.
 * - GenerateInfographicOutput - The return type for the generateInfographic function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { DrugHighlight } from '@/lib/types';

// We can pass the whole drug object to the flow
const GenerateInfographicInputSchema = z.object({
  drugName: z.string(),
  drugClass: z.string(),
  mechanism: z.string(),
  uses: z.string(),
  sideEffects: z.string(),
  contraindication: z.string(),
  funFact: z.string(),
});

export type GenerateInfographicInput = z.infer<typeof GenerateInfographicInputSchema>;

const GenerateInfographicOutputSchema = z.object({
  imageUrl: z.string().describe('The data URI of the generated infographic image.'),
});

export type GenerateInfographicOutput = z.infer<typeof GenerateInfographicOutputSchema>;

export async function generateInfographic(input: GenerateInfographicInput): Promise<GenerateInfographicOutput> {
  return generateInfographicFlow(input);
}

const promptTemplate = `Create a visually engaging, high-quality, professional medical infographic for the drug "{{drugName}}".

The infographic should be clean, modern, and easy to read, suitable for clinicians and medical students. Use a balanced layout with clear headings, icons, and illustrations.

Here is the information to include:

- **Title:** A Clinician's Guide to {{drugName}}
- **Mechanism of Action:** Visualize or explain how it works. Data: "{{mechanism}}"
- **Clinical Uses:** What is it used for? Data: "{{uses}}"
- **Common Side Effects:** What are the common side effects? Data: "{{sideEffects}}"
- **Contraindications/Safety Profile:** When should this drug NOT be used? Data: "{{contraindication}}"
- **Fun Fact:** Include an interesting fact about the drug. Data: "{{funFact}}"

Structure the content into clear sections like "Mechanism", "Clinical Uses", "Safety Profile", etc. The design should be professional, using a color palette appropriate for medical content. Ensure all text is legible.
`;

const generateInfographicFlow = ai.defineFlow(
  {
    name: 'generateInfographicFlow',
    inputSchema: GenerateInfographicInputSchema,
    outputSchema: GenerateInfographicOutputSchema,
  },
  async (input) => {
    try {
      const { media } = await ai.generate({
        model: 'googleai/imagen-4.0-fast-generate-001',
        prompt: promptTemplate
          .replace(/{{drugName}}/g, input.drugName)
          .replace(/{{mechanism}}/g, input.mechanism)
          .replace(/{{uses}}/g, input.uses)
          .replace(/{{sideEffects}}/g, input.sideEffects)
          .replace(/{{contraindication}}/g, input.contraindication)
          .replace(/{{funFact}}/g, input.funFact),
      });

      if (!media?.url) {
        throw new Error('Image generation failed to return a valid image.');
      }

      return { imageUrl: media.url };

    } catch (error: any) {
        if (error.message && error.message.includes('Imagen API is only accessible to billed users')) {
            throw new Error('Billing Required: The AI model for generating infographics (Imagen) requires a billing account to be enabled on your Google Cloud project. Please enable billing to use this feature.');
        }
        console.error("Error in generateInfographicFlow:", error);
        throw new Error('Failed to generate infographic due to an unexpected error.');
    }
  }
);
