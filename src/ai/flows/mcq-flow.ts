'use server';
/**
 * @fileOverview An AI flow to generate multiple-choice questions from drug data.
 *
 * - generateMcqs - A function that creates a quiz from a list of drug highlights.
 * - GenerateMcqsInput - The input type for the generateMcqs function.
 * - GenerateMcqsOutput - The return type for the generateMcqs function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { DrugHighlight } from '@/lib/types';

const McqQuestionSchema = z.object({
  question: z.string().describe('The multiple-choice question.'),
  options: z.array(z.string()).describe('An array of 4 possible answers.'),
  correctAnswer: z.string().describe('The correct answer from the options array.'),
});

export type McqQuestion = z.infer<typeof McqQuestionSchema>;

// We can reuse the DrugHighlight type for the input
const GenerateMcqsInputSchema = z.object({
  drugs: z.array(DrugHighlight).describe('An array of drug highlight objects to use as context for the quiz.'),
});
export type GenerateMcqsInput = z.infer<typeof GenerateMcqsInputSchema>;

// The output should be a list of questions
const GenerateMcqsOutputSchema = z.object({
    questions: z.array(McqQuestionSchema).length(10).describe('An array of exactly 10 multiple-choice questions.'),
});
export type GenerateMcqsOutput = z.infer<typeof GenerateMcqsOutputSchema>;

export async function generateMcqs(input: GenerateMcqsInput): Promise<GenerateMcqsOutput> {
  return generateMcqsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMcqsPrompt',
  input: { schema: GenerateMcqsInputSchema },
  output: { schema: GenerateMcqsOutputSchema },
  prompt: `You are an expert in medical education. Based on the following drug information, generate a 10-question multiple-choice quiz.
Each question should have 4 options. Ensure the questions cover different aspects of the provided drug data (e.g., mechanism, side effects, uses).

Context Drug Data:
{{#each drugs}}
- Drug: {{drugName}}
  Class: {{drugClass}}
  Mechanism: {{mechanism}}
  Uses: {{uses}}
  Side Effects: {{sideEffects}}
  Fun Fact: {{funFact}}
{{/each}}

Generate exactly 10 questions and provide the output in the requested JSON format.`,
});

const generateMcqsFlow = ai.defineFlow(
  {
    name: 'generateMcqsFlow',
    inputSchema: GenerateMcqsInputSchema,
    outputSchema: GenerateMcqsOutputSchema,
  },
  async (input) => {
    if (input.drugs.length === 0) {
        throw new Error('Cannot generate quiz with no drug data.');
    }
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate quiz from AI.');
    }
    return output;
  }
);
