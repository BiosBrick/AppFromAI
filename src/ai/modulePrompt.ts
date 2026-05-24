/**
 * @deprecated Use modulePromptExternal or modulePromptLocal directly.
 * This file exists only for backward compatibility with unmigrated imports.
 */
export { getJsonResponseRetryHint, buildModuleGenerationPrompt } from './modulePromptExternal';
export { buildSmallModelPrompt as buildLocalModelGenerationPrompt, buildGemma4Prompt as buildGemma4LocalGenerationPrompt, buildGemma4UiPass, buildGemma4CodePass } from './modulePromptLocal';
