export function cryptoRandomOrMathRandom()         {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] / 0x100000000;
  }
  return Math.random();
}

export function selectUniform   (
  array              ,
  rng               = cryptoRandomOrMathRandom
)    {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error('Cannot perform uniform selection on an empty or invalid array.');
  }

  const randomValue = rng();
  const clampedValue = randomValue >= 1 ? 0.9999999999999999 : randomValue < 0 ? 0 : randomValue;
  const index = Math.floor(clampedValue * array.length);

  return array[index];
}
