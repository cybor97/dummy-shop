function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  let i = 0;
  while (i < str.length) {
    const codePoint = str.codePointAt(i);
    if (codePoint === undefined) {
      i++;
      continue;
    }
    hash ^= codePoint;
    hash = Math.imul(hash, 0x01000193);

    i += codePoint > 0xffff ? 2 : 1;
  }
  return hash >>> 0;
}

export const stringToNumberInRange = (str: string, maxValue: number) => {
  const hash = fnv1aHash(str);
  return hash % (maxValue + 1);
};

const getRange = (start: string, end: string) => {
  return new Array(end.charCodeAt(0) - start.charCodeAt(0) + 1)
    .fill(0)
    .map((_, i) => i + start.charCodeAt(0));
};

const ALPHABET = [
  ...getRange("a", "z"),
  ...getRange("A", "Z"),
  ...getRange("0", "9"),
];
const HASH_LENGTH = 8;

// there might be a faster way to do this
function compressArray(arr: string[]) {
  if (arr.length <= HASH_LENGTH) return arr;

  const result = new Array(HASH_LENGTH).fill("");
  for (let i = 0; i < arr.length; i++) {
    const targetIndex = i % HASH_LENGTH;
    result[targetIndex] += arr[i];
  }

  return result;
}

export const hashString = (str: string) => {
  if (str.length < HASH_LENGTH) {
    if (str.length === 0) {
      // empty string
      return ALPHABET.slice(0, HASH_LENGTH)
        .map((char) => String.fromCharCode(char))
        .join("");
    }
    for (let i = str.length; i < HASH_LENGTH; i++) {
      // if string is shorter than hash length/2 it will be padded with "undefined". It's expected :D
      str += str[HASH_LENGTH - i - 1];
    }
  }

  // if it's too long - just glue everything together till it reaches hash length so it's both safe and deterministic for long strings
  const data = compressArray([...str]);
  const result = data
    .map((char) => {
      const hash = stringToNumberInRange(char, ALPHABET.length - 1);
      return String.fromCharCode(ALPHABET[hash]);
    })
    .join("");
  return result;
};
