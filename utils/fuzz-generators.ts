export type GeneratedValue<T> = {
  value: T;
  category: 'valid' | 'edge' | 'invalid' | 'malformed';
  description: string;
};

export const stringGenerator = (): GeneratedValue<any>[] => [
  { value: 'normal string', category: 'valid', description: 'normal string' },
  { value: 'Test123', category: 'valid', description: 'alphanumeric' },
  { value: 'café', category: 'valid', description: 'unicode chars' },
  { value: '日本語', category: 'valid', description: 'CJK characters' },
  { value: '', category: 'edge', description: 'empty string' },
  { value: ' ', category: 'edge', description: 'single space' },
  { value: '   ', category: 'edge', description: 'multiple spaces' },
  { value: '\t\n', category: 'edge', description: 'whitespace only' },
  { value: 'a', category: 'edge', description: 'single char' },
  { value: 'a'.repeat(1000), category: 'edge', description: '1000 chars' },
  { value: 'a'.repeat(10000), category: 'malformed', description: '10000 chars' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
  { value: 123, category: 'invalid', description: 'number instead of string' },
  { value: {}, category: 'invalid', description: 'object instead of string' },
  { value: [], category: 'invalid', description: 'array instead of string' },
  { value: "'; DROP TABLE supplements; --", category: 'malformed', description: 'SQL injection 1' },
  { value: "1; DELETE FROM supplements WHERE 1=1; --", category: 'malformed', description: 'SQL injection 2' },
  { value: "' OR '1'='1", category: 'malformed', description: 'SQL injection 3' },
  { value: '<script>alert("xss")</script>', category: 'malformed', description: 'XSS attempt' },
  { value: '${process.env.SECRET}', category: 'malformed', description: 'template injection' },
  { value: '\x00\x01\x02', category: 'malformed', description: 'null bytes' },
  { value: '🎉🔥💀', category: 'edge', description: 'emoji only' },
  { value: '\u202E\u0041\u0042\u0043', category: 'malformed', description: 'RTL override' },
];

export const positiveNumberGenerator = (): GeneratedValue<any>[] => [
  { value: 1, category: 'valid', description: 'one' },
  { value: 100, category: 'valid', description: 'hundred' },
  { value: 0.5, category: 'valid', description: 'decimal' },
  { value: 0.001, category: 'edge', description: 'very small positive' },
  { value: 999999, category: 'edge', description: 'large number' },
  { value: Number.MAX_SAFE_INTEGER, category: 'edge', description: 'max safe int' },
  { value: 0, category: 'invalid', description: 'zero' },
  { value: -1, category: 'invalid', description: 'negative' },
  { value: -0.001, category: 'invalid', description: 'small negative' },
  { value: NaN, category: 'invalid', description: 'NaN' },
  { value: Infinity, category: 'invalid', description: 'Infinity' },
  { value: -Infinity, category: 'invalid', description: '-Infinity' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
  { value: '100', category: 'invalid', description: 'string number' },
  { value: {}, category: 'invalid', description: 'object' },
];

export const idGenerator = (): GeneratedValue<any>[] => [
  { value: 1, category: 'valid', description: 'one' },
  { value: 100, category: 'valid', description: 'hundred' },
  { value: 999999, category: 'valid', description: 'large id' },
  { value: 0, category: 'invalid', description: 'zero' },
  { value: -1, category: 'invalid', description: 'negative' },
  { value: 1.5, category: 'invalid', description: 'non-integer' },
  { value: NaN, category: 'invalid', description: 'NaN' },
  { value: Infinity, category: 'invalid', description: 'Infinity' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
  { value: '1', category: 'invalid', description: 'string id' },
  { value: {}, category: 'invalid', description: 'object' },
];

export const severityGenerator = (): GeneratedValue<any>[] => [
  { value: 1, category: 'valid', description: 'min severity' },
  { value: 3, category: 'valid', description: 'mid severity' },
  { value: 5, category: 'valid', description: 'max severity' },
  { value: 0, category: 'invalid', description: 'zero (below min)' },
  { value: 6, category: 'invalid', description: 'six (above max)' },
  { value: -1, category: 'invalid', description: 'negative' },
  { value: 10, category: 'invalid', description: 'ten' },
  { value: 2.5, category: 'edge', description: 'decimal in range' },
  { value: NaN, category: 'invalid', description: 'NaN' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
  { value: '3', category: 'invalid', description: 'string severity' },
];

export const timestampGenerator = (): GeneratedValue<any>[] => {
  const now = Math.floor(Date.now() / 1000);
  return [
    { value: now, category: 'valid', description: 'current time' },
    { value: now - 86400, category: 'valid', description: 'yesterday' },
    { value: now - 86400 * 365, category: 'valid', description: 'one year ago' },
    { value: now + 86400, category: 'valid', description: 'tomorrow' },
    { value: 1000000000, category: 'edge', description: 'year 2001' },
    { value: 2000000000, category: 'edge', description: 'year 2033' },
    { value: 0, category: 'invalid', description: 'zero (epoch)' },
    { value: -1, category: 'invalid', description: 'negative' },
    { value: 5000000000, category: 'invalid', description: 'year 2128 (too far)' },
    { value: NaN, category: 'invalid', description: 'NaN' },
    { value: null, category: 'invalid', description: 'null' },
    { value: undefined, category: 'invalid', description: 'undefined' },
    { value: '1700000000', category: 'invalid', description: 'string timestamp' },
  ];
};

export const bodyRegionGenerator = (): GeneratedValue<any>[] => [
  { value: 'head', category: 'valid', description: 'head' },
  { value: 'thorax', category: 'valid', description: 'thorax' },
  { value: 'abdomen', category: 'valid', description: 'abdomen' },
  { value: 'pelvis', category: 'valid', description: 'pelvis' },
  { value: 'arms', category: 'valid', description: 'arms' },
  { value: 'hands', category: 'valid', description: 'hands' },
  { value: 'legs', category: 'valid', description: 'legs' },
  { value: 'feet', category: 'valid', description: 'feet' },
  { value: 'HEAD', category: 'invalid', description: 'uppercase' },
  { value: 'Head', category: 'invalid', description: 'capitalized' },
  { value: 'brain', category: 'invalid', description: 'invalid region' },
  { value: '', category: 'invalid', description: 'empty string' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
  { value: 123, category: 'invalid', description: 'number' },
];

export const testTypeGenerator = (): GeneratedValue<any>[] => [
  { value: 'reflexes', category: 'valid', description: 'reflexes' },
  { value: 'memory', category: 'valid', description: 'memory' },
  { value: 'judgment', category: 'valid', description: 'judgment' },
  { value: 'rock_dodger', category: 'valid', description: 'rock_dodger' },
  { value: 'pattern_matcher', category: 'valid', description: 'pattern_matcher' },
  { value: 'tile_puzzle', category: 'valid', description: 'tile_puzzle' },
  { value: 'n_back', category: 'valid', description: 'n_back' },
  { value: 'MEMORY', category: 'invalid', description: 'uppercase' },
  { value: 'invalid_test', category: 'invalid', description: 'invalid type' },
  { value: '', category: 'invalid', description: 'empty string' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
];

export const hexColorGenerator = (): GeneratedValue<any>[] => [
  { value: '#007AFF', category: 'valid', description: 'blue' },
  { value: '#FF0000', category: 'valid', description: 'red' },
  { value: '#ffffff', category: 'valid', description: 'white lowercase' },
  { value: '#000000', category: 'valid', description: 'black' },
  { value: '#ABCDEF', category: 'valid', description: 'hex letters' },
  { value: undefined, category: 'valid', description: 'undefined (optional)' },
  { value: '007AFF', category: 'invalid', description: 'missing hash' },
  { value: '#fff', category: 'invalid', description: 'shorthand' },
  { value: '#GGGGGG', category: 'invalid', description: 'invalid hex chars' },
  { value: 'red', category: 'invalid', description: 'color name' },
  { value: 'rgb(0,0,0)', category: 'invalid', description: 'rgb format' },
  { value: '', category: 'edge', description: 'empty string (falsy)' },
  { value: null, category: 'edge', description: 'null (falsy)' },
];

export const accuracyGenerator = (): GeneratedValue<any>[] => [
  { value: 0, category: 'valid', description: 'zero percent' },
  { value: 50, category: 'valid', description: 'fifty percent' },
  { value: 100, category: 'valid', description: 'hundred percent' },
  { value: 0.5, category: 'valid', description: 'decimal accuracy' },
  { value: 99.9, category: 'valid', description: 'near perfect' },
  { value: -1, category: 'invalid', description: 'negative' },
  { value: 101, category: 'invalid', description: 'over 100' },
  { value: 150, category: 'invalid', description: 'way over 100' },
  { value: NaN, category: 'invalid', description: 'NaN' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'edge', description: 'undefined (optional)' },
];

export const scoreGenerator = (): GeneratedValue<any>[] => [
  { value: 0, category: 'valid', description: 'zero score' },
  { value: 50, category: 'valid', description: 'mid score' },
  { value: 100, category: 'valid', description: 'high score' },
  { value: 999999, category: 'valid', description: 'very high score' },
  { value: 0.5, category: 'valid', description: 'decimal score' },
  { value: -1, category: 'invalid', description: 'negative score' },
  { value: -100, category: 'invalid', description: 'very negative' },
  { value: NaN, category: 'invalid', description: 'NaN' },
  { value: null, category: 'invalid', description: 'null' },
  { value: undefined, category: 'invalid', description: 'undefined' },
  { value: '100', category: 'invalid', description: 'string score' },
];

export const optionalStringGenerator = (): GeneratedValue<any>[] => [
  { value: undefined, category: 'valid', description: 'undefined (omitted)' },
  { value: null, category: 'edge', description: 'null' },
  { value: '', category: 'edge', description: 'empty string' },
  { value: 'notes here', category: 'valid', description: 'normal notes' },
  { value: 'a'.repeat(1000), category: 'edge', description: 'long notes' },
  { value: "'; DROP TABLE --", category: 'malformed', description: 'SQL injection' },
];
