import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runToolLoop } from '../src/lib/model.js';
import { createToolbox } from '../src/lib/tools.js';

/** A stand-in for the OpenAI client that replays scripted answers. */
function scriptedModel(answers) {
  const requests = [];
  return {
    requests,
    chat: {
      completions: {
        create: async (params) => {
          requests.push(structuredClone(params));
          const answer = answers.shift();
          if (answer instanceof Error) throw answer;
          return { choices: [{ message: answer }] };
        },
      },
    },
  };
}

const call = (id, name, args) => ({
  id,
  type: 'function',
  function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
});
const toolCalls = (...calls) => ({ role: 'assistant', content: null, tool_calls: calls });

/** A toolbox with fake tools: `finish` ends the run. */
function fakeToolbox() {
  const calls = [];
  let outcome = null;
  return {
    calls,
    definitions: [],
    get outcome() {
      return outcome;
    },
    async call(name, args) {
      calls.push(name);
      if (name === 'finish') outcome = { status: 'needs_approval' };
      return { ok: true, args };
    },
  };
}

test('the loop runs tools in order and stops at the finishing tool', async () => {
  const openai = scriptedModel([
    toolCalls(call('1', 'get_order', {}), call('2', 'read_policy', { topic: 'overview' })),
    toolCalls(call('3', 'finish', {}), call('4', 'get_order', {})),
  ]);
  const toolbox = fakeToolbox();
  const result = await runToolLoop({ openai, model: 'm', messages: [], toolbox });
  assert.deepEqual(result, { outcome: { status: 'needs_approval' } });
  assert.deepEqual(toolbox.calls, ['get_order', 'read_policy', 'finish']);
  assert.equal(openai.requests[0].tool_choice, 'required');
  assert.equal(openai.requests[1].messages.filter((message) => message.role === 'tool').length, 2);
});

test('an answer without tool calls stops the loop', async () => {
  const openai = scriptedModel([{ role: 'assistant', content: 'Looks fine to me.' }]);
  const result = await runToolLoop({ openai, model: 'm', messages: [], toolbox: fakeToolbox() });
  assert.match(result.stopReason, /without choosing a next step/);
});

test('the loop gives up after the last round', async () => {
  const openai = scriptedModel(Array.from({ length: 3 }, (_, i) => toolCalls(call(String(i), 'get_order', {}))));
  const result = await runToolLoop({ openai, model: 'm', messages: [], toolbox: fakeToolbox(), maxRounds: 3 });
  assert.match(result.stopReason, /did not reach a decision in 3 rounds/);
});

test('a failed model call reaches the caller', async () => {
  const openai = scriptedModel([new Error('400 not a valid model ID')]);
  await assert.rejects(runToolLoop({ openai, model: 'm', messages: [], toolbox: fakeToolbox() }), /not a valid model ID/);
});

test('bad tool calls go back to the model as errors', async () => {
  const ctx = { log: () => {}, config: {} };
  const toolbox = createToolbox(ctx, {}, { $id: 'r1', reason: 'damaged' }, { job: 'reply' });
  assert.deepEqual(await toolbox.call('delete_everything', '{}'), { error: 'There is no tool named delete_everything.' });
  assert.deepEqual(await toolbox.call('read_policy', '{"topic":'), { error: 'The tool arguments were not valid JSON.' });
  // The reply run cannot refund: the tool is not offered and not callable.
  assert.equal(toolbox.definitions.some((definition) => definition.function.name === 'issue_refund'), false);
  assert.deepEqual(await toolbox.call('issue_refund', '{"reason":"x"}'), { error: 'There is no tool named issue_refund.' });
});

test('a tool that throws returns the error to the model', async () => {
  const ctx = { log: () => {}, config: {} };
  const run = {
    tool: async (_name, _title, work) => (await work()).result,
  };
  const toolbox = createToolbox(ctx, run, { $id: 'r1', reason: 'damaged' }, { job: 'intake' });
  const result = await toolbox.call('read_policy', JSON.stringify({ topic: 'secret_rules' }));
  assert.deepEqual(result, { error: 'Unknown policy topic secret_rules.' });
  assert.equal(toolbox.outcome, null);
});

test('tool definitions are strict and take no IDs', async () => {
  const { TOOL_DEFINITIONS } = await import('../src/lib/tools.js');
  for (const { function: fn } of TOOL_DEFINITIONS) {
    assert.equal(fn.strict, true, fn.name);
    assert.equal(fn.parameters.additionalProperties, false, fn.name);
    assert.deepEqual(fn.parameters.required, Object.keys(fn.parameters.properties), fn.name);
    for (const key of Object.keys(fn.parameters.properties)) assert.doesNotMatch(key, /id$/i, `${fn.name}.${key}`);
  }
});
