import { runFuzzer, printSummary, FuzzableFunction } from '../utils/fuzzer';
import {
  stringGenerator,
  positiveNumberGenerator,
  idGenerator,
  severityGenerator,
  timestampGenerator,
  bodyRegionGenerator,
  testTypeGenerator,
  hexColorGenerator,
  accuracyGenerator,
  scoreGenerator,
  optionalStringGenerator,
} from '../utils/fuzz-generators';
import {
  instrumentedAddSupplement,
  instrumentedLogSupplement,
  instrumentedAddSymptom,
  instrumentedLogSymptom,
  instrumentedSaveCognitiveTestResult,
  instrumentedLogSleep,
} from '../utils/instrumented-db';
import { isNonEmptyString, isPositiveNumber, isValidId, isInRange, isValidBodyRegion, isValidTestType, isValidTimestamp, isValidHexColor } from '../utils/db-invariants';

const supplementFunctions: FuzzableFunction[] = [
  {
    name: 'addSupplement',
    fn: async (name: any, dosage: any, unit: any, color: any) => {
      const uniqueName = typeof name === 'string' ? `${name}_${Date.now()}_${Math.random()}` : name;
      return instrumentedAddSupplement({
        name: uniqueName,
        default_dosage: dosage,
        dosage_unit: unit,
        color,
        schedule_enabled: false,
        study_enabled: false,
      });
    },
    inputGenerators: [
      stringGenerator,
      positiveNumberGenerator,
      stringGenerator,
      hexColorGenerator,
    ],
    expectValidFor: ([name, dosage, unit, color]) =>
      isNonEmptyString(name) &&
      isPositiveNumber(dosage) &&
      isNonEmptyString(unit) &&
      (!color || isValidHexColor(color)),
  },
  {
    name: 'logSupplement',
    fn: async (supplementId: any, dosage: any, notes: any) => {
      return instrumentedLogSupplement(supplementId, dosage, notes);
    },
    inputGenerators: [
      idGenerator,
      positiveNumberGenerator,
      optionalStringGenerator,
    ],
    expectValidFor: ([id, dosage, _notes]) =>
      isValidId(id) && isPositiveNumber(dosage),
  },
];

const symptomFunctions: FuzzableFunction[] = [
  {
    name: 'addSymptom',
    fn: async (region: any, description: any) => {
      return instrumentedAddSymptom(region, description);
    },
    inputGenerators: [
      bodyRegionGenerator,
      stringGenerator,
    ],
    expectValidFor: ([region, desc]) =>
      isValidBodyRegion(region) && isNonEmptyString(desc),
  },
  {
    name: 'logSymptom',
    fn: async (symptomId: any, severity: any, notes: any) => {
      return instrumentedLogSymptom(symptomId, severity, notes);
    },
    inputGenerators: [
      idGenerator,
      severityGenerator,
      optionalStringGenerator,
    ],
    expectValidFor: ([id, severity, _notes]) =>
      isValidId(id) && isInRange(severity, 1, 5),
  },
];

const cognitiveFunctions: FuzzableFunction[] = [
  {
    name: 'saveCognitiveTestResult',
    fn: async (testType: any, score: any, accuracy: any) => {
      return instrumentedSaveCognitiveTestResult(testType, score, undefined, undefined, undefined, undefined, accuracy);
    },
    inputGenerators: [
      testTypeGenerator,
      scoreGenerator,
      accuracyGenerator,
    ],
    expectValidFor: ([type, score, accuracy]) =>
      isValidTestType(type) &&
      (typeof score === 'number' && !isNaN(score) && score >= 0) &&
      (accuracy === undefined || (typeof accuracy === 'number' && !isNaN(accuracy) && accuracy >= 0 && accuracy <= 100)),
  },
];

const sleepFunctions: FuzzableFunction[] = [
  {
    name: 'logSleep',
    fn: async (start: any, end: any) => {
      return instrumentedLogSleep(start, end);
    },
    inputGenerators: [
      timestampGenerator,
      timestampGenerator,
    ],
    expectValidFor: ([start, end]) =>
      isValidTimestamp(start) && isValidTimestamp(end) && end > start,
  },
];

describe('Fuzzer', () => {
  jest.setTimeout(120000);

  it('fuzzes supplement functions', async () => {
    const { summary } = await runFuzzer(supplementFunctions, { maxCombinations: 200 });

    printSummary(summary);

    expect(summary.totalRuns).toBeGreaterThan(0);
    expect(summary.coverageStats.functionsTesd).toBe(2);
  });

  it('fuzzes symptom functions', async () => {
    const { summary } = await runFuzzer(symptomFunctions, { maxCombinations: 200 });

    printSummary(summary);

    expect(summary.totalRuns).toBeGreaterThan(0);
  });

  it('fuzzes cognitive test functions', async () => {
    const { summary } = await runFuzzer(cognitiveFunctions, { maxCombinations: 200 });

    printSummary(summary);

    expect(summary.totalRuns).toBeGreaterThan(0);
  });

  it('fuzzes sleep functions', async () => {
    const { summary } = await runFuzzer(sleepFunctions, { maxCombinations: 200 });

    printSummary(summary);

    expect(summary.totalRuns).toBeGreaterThan(0);
  });

  it('runs comprehensive fuzz test on all functions', async () => {
    const allFunctions = [
      ...supplementFunctions,
      ...symptomFunctions,
      ...cognitiveFunctions,
      ...sleepFunctions,
    ];

    const { summary } = await runFuzzer(allFunctions, { maxCombinations: 100, verbose: false });

    console.log('\n\n========================================');
    console.log('    COMPREHENSIVE FUZZ TEST RESULTS');
    console.log('========================================\n');
    printSummary(summary);

    expect(summary.totalRuns).toBeGreaterThan(100);
    expect(summary.coverageStats.functionsTesd).toBe(6);
    expect(summary.coverageStats.inputCategoriesTested).toContain('valid');
    expect(summary.coverageStats.inputCategoriesTested).toContain('invalid');
  });
});
