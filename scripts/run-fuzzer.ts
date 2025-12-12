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
import {
  isNonEmptyString,
  isPositiveNumber,
  isValidId,
  isInRange,
  isValidBodyRegion,
  isValidTestType,
  isValidTimestamp,
  isValidHexColor,
} from '../utils/db-invariants';

const allFunctions: FuzzableFunction[] = [
  {
    name: 'addSupplement',
    fn: async (name: any, dosage: any, unit: any, color: any) => {
      return instrumentedAddSupplement({
        name,
        default_dosage: dosage,
        dosage_unit: unit,
        color,
        schedule_enabled: false,
        study_enabled: false,
      });
    },
    inputGenerators: [stringGenerator, positiveNumberGenerator, stringGenerator, hexColorGenerator],
    expectValidFor: ([name, dosage, unit, color]) =>
      isNonEmptyString(name) && isPositiveNumber(dosage) && isNonEmptyString(unit) &&
      (color === undefined || isValidHexColor(color)),
  },
  {
    name: 'logSupplement',
    fn: async (supplementId: any, dosage: any, notes: any) => {
      return instrumentedLogSupplement(supplementId, dosage, notes);
    },
    inputGenerators: [idGenerator, positiveNumberGenerator, optionalStringGenerator],
    expectValidFor: ([id, dosage]) => isValidId(id) && isPositiveNumber(dosage),
  },
  {
    name: 'addSymptom',
    fn: async (region: any, description: any) => {
      return instrumentedAddSymptom(region, description);
    },
    inputGenerators: [bodyRegionGenerator, stringGenerator],
    expectValidFor: ([region, desc]) => isValidBodyRegion(region) && isNonEmptyString(desc),
  },
  {
    name: 'logSymptom',
    fn: async (symptomId: any, severity: any, notes: any) => {
      return instrumentedLogSymptom(symptomId, severity, notes);
    },
    inputGenerators: [idGenerator, severityGenerator, optionalStringGenerator],
    expectValidFor: ([id, severity]) => isValidId(id) && isInRange(severity, 1, 5),
  },
  {
    name: 'saveCognitiveTestResult',
    fn: async (testType: any, score: any, accuracy: any) => {
      return instrumentedSaveCognitiveTestResult(testType, score, undefined, undefined, undefined, undefined, accuracy);
    },
    inputGenerators: [testTypeGenerator, scoreGenerator, accuracyGenerator],
    expectValidFor: ([type, score, accuracy]) =>
      isValidTestType(type) &&
      (typeof score === 'number' && !isNaN(score) && score >= 0) &&
      (accuracy === undefined || (typeof accuracy === 'number' && !isNaN(accuracy) && accuracy >= 0 && accuracy <= 100)),
  },
  {
    name: 'logSleep',
    fn: async (start: any, end: any) => {
      return instrumentedLogSleep(start, end);
    },
    inputGenerators: [timestampGenerator, timestampGenerator],
    expectValidFor: ([start, end]) => isValidTimestamp(start) && isValidTimestamp(end) && end > start,
  },
];

async function main() {
  console.log('Initializing database...');

  const { resetMockDatabase, getMockDatabase } = await import('../__tests__/__mocks__/expo-sqlite');
  const db = await import('../database/database');

  resetMockDatabase();
  db.resetDatabaseState();
  getMockDatabase();
  await db.initializeDatabaseWithRetry(1, 0);

  console.log('Database initialized. Starting fuzzer...\n');

  const maxCombinations = parseInt(process.argv[2] || '200', 10);
  console.log(`Max combinations per function: ${maxCombinations}\n`);

  const { results, summary } = await runFuzzer(allFunctions, {
    maxCombinations,
    verbose: true,
  });

  printSummary(summary);

  if (summary.unexpectedSuccesses.length > 0 || summary.unexpectedFailures.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fuzzer failed:', err);
  process.exit(1);
});
