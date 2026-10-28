/** Unknown configuration fails toward local/browser speech, never credentials guessing. */
export function effectiveSpeechProvider(preference, configuration) {
  if (preference !== 'auto') return preference;
  return configuration?.configured === true ? 'auto' : 'browser';
}
