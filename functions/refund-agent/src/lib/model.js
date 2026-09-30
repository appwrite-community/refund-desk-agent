import OpenAI from 'openai';

export const MAX_ROUNDS = 8;

/** OpenRouter speaks the OpenAI Chat Completions API, so the OpenAI SDK works with a different base URL. */
export function createModelClient(config) {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouterApiKey,
    timeout: 45_000,
    maxRetries: 1,
  });
}

/** One call that must answer with JSON matching `schema`. */
export async function structuredOutput(openai, model, { name, schema, messages }) {
  const completion = await openai.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('The model returned an empty answer.');
  return JSON.parse(content);
}

/**
 * The tool loop. `tool_choice: 'required'` makes the model call a tool in every
 * round, so the loop ends only when a finishing tool succeeds (the toolbox then
 * reports an outcome) or the rounds run out.
 */
export async function runToolLoop({ openai, model, messages, toolbox, maxRounds = MAX_ROUNDS }) {
  for (let round = 1; round <= maxRounds; round++) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: toolbox.definitions,
      tool_choice: 'required',
    });
    const message = completion.choices[0]?.message;
    const calls = message?.tool_calls ?? [];
    if (calls.length === 0) return { stopReason: 'The model answered without choosing a next step.' };

    messages.push(message);
    // Several calls in one answer run one after another, so the timeline stays in order.
    for (const call of calls) {
      const result = await toolbox.call(call.function?.name, call.function?.arguments);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      if (toolbox.outcome) return { outcome: toolbox.outcome };
    }
  }
  return { stopReason: `The model did not reach a decision in ${maxRounds} rounds.` };
}
