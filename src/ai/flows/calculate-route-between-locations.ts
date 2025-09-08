'use server';
/**
 * @fileOverview Flow to calculate a route between two locations.
 *
 * - calculateRoute - A function that calculates the route between two locations.
 * - CalculateRouteInput - The input type for the calculateRoute function.
 * - CalculateRouteOutput - The return type for the calculateRoute function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateRouteInputSchema = z.object({
  startLocation: z.string().describe('The starting location for the route.'),
  endLocation: z.string().describe('The destination location for the route.'),
});
export type CalculateRouteInput = z.infer<typeof CalculateRouteInputSchema>;

const CalculateRouteOutputSchema = z.object({
  route: z.string().describe('The calculated route between the two locations.'),
  isViable: z.boolean().describe('Whether the route is viable or not.'),
});
export type CalculateRouteOutput = z.infer<typeof CalculateRouteOutputSchema>;

export async function calculateRoute(input: CalculateRouteInput): Promise<CalculateRouteOutput> {
  return calculateRouteFlow(input);
}

const isRouteViable = ai.defineTool({
  name: 'isRouteViable',
  description: 'Checks if a route between two locations is viable.',
  inputSchema: z.object({
    startLocation: z.string().describe('The starting location.'),
    endLocation: z.string().describe('The destination location.'),
  }),
  outputSchema: z.boolean(),
}, async (input) => {
  // Placeholder implementation:  In a real application, this would involve
  // calling a maps API or other service to determine route viability.
  // For this example, we'll just return true.
  return true;
});

const routePrompt = ai.definePrompt({
  name: 'routePrompt',
  input: {schema: CalculateRouteInputSchema},
  output: {schema: CalculateRouteOutputSchema},
  tools: [isRouteViable],
  prompt: `You are a route planning expert.  Given a starting location and an ending location,
you will respond with a route between the two locations.

Use the isRouteViable tool to check if the route is viable before responding.

Start Location: {{{startLocation}}}
End Location: {{{endLocation}}}`,
});

const calculateRouteFlow = ai.defineFlow(
  {
    name: 'calculateRouteFlow',
    inputSchema: CalculateRouteInputSchema,
    outputSchema: CalculateRouteOutputSchema,
  },
  async input => {
    const isViable = await isRouteViable({
      startLocation: input.startLocation,
      endLocation: input.endLocation,
    });

    const {output} = await routePrompt({
      ...input,
      isViable,
    });
    return output!;
  }
);
