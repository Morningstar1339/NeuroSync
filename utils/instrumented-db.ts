import {
  reportViolation,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  isValidId,
  isInRange,
  isValidTimestamp,
  isValidHexColor,
  isValidBodyRegion,
  isValidTestType,
  isArray,
} from './db-invariants';

import * as supplements from '../database/supplements';
import * as symptoms from '../database/symptoms';
import * as cognitiveTests from '../database/cognitive-tests';
import * as sleep from '../database/sleep';

const MODULE_SUPPLEMENTS = 'supplements';
const MODULE_SYMPTOMS = 'symptoms';
const MODULE_COGNITIVE = 'cognitive-tests';
const MODULE_SLEEP = 'sleep';

export const instrumentedAddSupplement = async (
  supplement: Omit<supplements.Supplement, 'id'>
): Promise<number> => {
  if (!isNonEmptyString(supplement.name)) {
    reportViolation(MODULE_SUPPLEMENTS, 'addSupplement', 'name_non_empty', supplement.name, 'non-empty string');
  }
  if (!isPositiveNumber(supplement.default_dosage)) {
    reportViolation(MODULE_SUPPLEMENTS, 'addSupplement', 'default_dosage_positive', supplement.default_dosage, 'positive number');
  }
  if (!isNonEmptyString(supplement.dosage_unit)) {
    reportViolation(MODULE_SUPPLEMENTS, 'addSupplement', 'dosage_unit_non_empty', supplement.dosage_unit, 'non-empty string');
  }
  if (supplement.color && !isValidHexColor(supplement.color)) {
    reportViolation(MODULE_SUPPLEMENTS, 'addSupplement', 'color_hex_format', supplement.color, 'hex color (#RRGGBB)');
  }

  const result = await supplements.addSupplement(supplement);

  if (!isValidId(result)) {
    reportViolation(MODULE_SUPPLEMENTS, 'addSupplement', 'return_valid_id', result, 'positive integer ID', 'post');
  }

  return result;
};

export const instrumentedUpdateSupplement = async (
  supplement: supplements.Supplement
): Promise<void> => {
  if (!isValidId(supplement.id)) {
    reportViolation(MODULE_SUPPLEMENTS, 'updateSupplement', 'id_valid', supplement.id, 'positive integer');
  }
  if (!isNonEmptyString(supplement.name)) {
    reportViolation(MODULE_SUPPLEMENTS, 'updateSupplement', 'name_non_empty', supplement.name, 'non-empty string');
  }
  if (!isPositiveNumber(supplement.default_dosage)) {
    reportViolation(MODULE_SUPPLEMENTS, 'updateSupplement', 'default_dosage_positive', supplement.default_dosage, 'positive number');
  }
  if (!isNonEmptyString(supplement.dosage_unit)) {
    reportViolation(MODULE_SUPPLEMENTS, 'updateSupplement', 'dosage_unit_non_empty', supplement.dosage_unit, 'non-empty string');
  }

  return supplements.updateSupplement(supplement);
};

export const instrumentedLogSupplement = async (
  supplementId: number,
  dosage: number,
  notes?: string,
  timestamp?: number
): Promise<number> => {
  if (!isValidId(supplementId)) {
    reportViolation(MODULE_SUPPLEMENTS, 'logSupplement', 'supplement_id_valid', supplementId, 'positive integer');
  }
  if (!isPositiveNumber(dosage)) {
    reportViolation(MODULE_SUPPLEMENTS, 'logSupplement', 'dosage_positive', dosage, 'positive number');
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    reportViolation(MODULE_SUPPLEMENTS, 'logSupplement', 'notes_string_or_undefined', notes, 'string or undefined');
  }
  if (timestamp !== undefined && !isValidTimestamp(timestamp)) {
    reportViolation(MODULE_SUPPLEMENTS, 'logSupplement', 'timestamp_valid', timestamp, 'valid unix timestamp');
  }

  const result = await supplements.logSupplement(supplementId, dosage, notes, timestamp);

  if (!isValidId(result)) {
    reportViolation(MODULE_SUPPLEMENTS, 'logSupplement', 'return_valid_id', result, 'positive integer ID', 'post');
  }

  return result;
};

export const instrumentedGetAllSupplements = async (): Promise<supplements.Supplement[]> => {
  const result = await supplements.getAllSupplements();

  if (!isArray(result)) {
    reportViolation(MODULE_SUPPLEMENTS, 'getAllSupplements', 'return_array', result, 'array', 'post');
  }

  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    if (!isValidId(s.id)) {
      reportViolation(MODULE_SUPPLEMENTS, 'getAllSupplements', `result[${i}].id_valid`, s.id, 'positive integer', 'post');
    }
    if (!isNonEmptyString(s.name)) {
      reportViolation(MODULE_SUPPLEMENTS, 'getAllSupplements', `result[${i}].name_non_empty`, s.name, 'non-empty string', 'post');
    }
    if (!isPositiveNumber(s.default_dosage)) {
      reportViolation(MODULE_SUPPLEMENTS, 'getAllSupplements', `result[${i}].default_dosage_positive`, s.default_dosage, 'positive number', 'post');
    }
  }

  return result;
};

export const instrumentedGetSupplementLogs = async (
  supplementId?: number,
  limit?: number
): Promise<supplements.SupplementLog[]> => {
  if (supplementId !== undefined && !isValidId(supplementId)) {
    reportViolation(MODULE_SUPPLEMENTS, 'getSupplementLogs', 'supplement_id_valid', supplementId, 'positive integer or undefined');
  }
  if (limit !== undefined && !isPositiveNumber(limit)) {
    reportViolation(MODULE_SUPPLEMENTS, 'getSupplementLogs', 'limit_positive', limit, 'positive number or undefined');
  }

  const result = await supplements.getSupplementLogs(supplementId, limit);

  if (!isArray(result)) {
    reportViolation(MODULE_SUPPLEMENTS, 'getSupplementLogs', 'return_array', result, 'array', 'post');
  }

  for (let i = 0; i < result.length; i++) {
    const log = result[i];
    if (!isValidId(log.id)) {
      reportViolation(MODULE_SUPPLEMENTS, 'getSupplementLogs', `result[${i}].id_valid`, log.id, 'positive integer', 'post');
    }
    if (!isValidId(log.supplement_id)) {
      reportViolation(MODULE_SUPPLEMENTS, 'getSupplementLogs', `result[${i}].supplement_id_valid`, log.supplement_id, 'positive integer', 'post');
    }
    if (!isPositiveNumber(log.dosage)) {
      reportViolation(MODULE_SUPPLEMENTS, 'getSupplementLogs', `result[${i}].dosage_positive`, log.dosage, 'positive number', 'post');
    }
  }

  return result;
};

export const instrumentedAddSymptom = async (
  bodyRegion: symptoms.BodyRegion,
  description: string
): Promise<number> => {
  if (!isValidBodyRegion(bodyRegion)) {
    reportViolation(MODULE_SYMPTOMS, 'addSymptom', 'body_region_valid', bodyRegion, 'valid body region');
  }
  if (!isNonEmptyString(description)) {
    reportViolation(MODULE_SYMPTOMS, 'addSymptom', 'description_non_empty', description, 'non-empty string');
  }

  const result = await symptoms.addSymptom(bodyRegion, description);

  if (result !== -1 && !isValidId(result)) {
    reportViolation(MODULE_SYMPTOMS, 'addSymptom', 'return_valid_id_or_neg1', result, 'positive integer or -1', 'post');
  }

  return result;
};

export const instrumentedLogSymptom = async (
  symptomId: number,
  severity: number,
  notes?: string
): Promise<number> => {
  if (!isValidId(symptomId)) {
    reportViolation(MODULE_SYMPTOMS, 'logSymptom', 'symptom_id_valid', symptomId, 'positive integer');
  }
  if (!isInRange(severity, 1, 5)) {
    reportViolation(MODULE_SYMPTOMS, 'logSymptom', 'severity_in_range', severity, 'number between 1 and 5');
  }

  const result = await symptoms.logSymptom(symptomId, severity, notes);

  if (result !== -1 && !isValidId(result)) {
    reportViolation(MODULE_SYMPTOMS, 'logSymptom', 'return_valid_id_or_neg1', result, 'positive integer or -1', 'post');
  }

  return result;
};

export const instrumentedGetSymptomsByRegion = async (
  bodyRegion: symptoms.BodyRegion
): Promise<symptoms.Symptom[]> => {
  if (!isValidBodyRegion(bodyRegion)) {
    reportViolation(MODULE_SYMPTOMS, 'getSymptomsByRegion', 'body_region_valid', bodyRegion, 'valid body region');
  }

  const result = await symptoms.getSymptomsByRegion(bodyRegion);

  if (!isArray(result)) {
    reportViolation(MODULE_SYMPTOMS, 'getSymptomsByRegion', 'return_array', result, 'array', 'post');
  }

  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    if (!isValidId(s.id)) {
      reportViolation(MODULE_SYMPTOMS, 'getSymptomsByRegion', `result[${i}].id_valid`, s.id, 'positive integer', 'post');
    }
    if (!isValidBodyRegion(s.body_region)) {
      reportViolation(MODULE_SYMPTOMS, 'getSymptomsByRegion', `result[${i}].body_region_valid`, s.body_region, 'valid body region', 'post');
    }
  }

  return result;
};

export const instrumentedGetSymptomLogs = async (
  symptomId?: number,
  limit?: number
): Promise<symptoms.SymptomLog[]> => {
  if (symptomId !== undefined && !isValidId(symptomId)) {
    reportViolation(MODULE_SYMPTOMS, 'getSymptomLogs', 'symptom_id_valid', symptomId, 'positive integer or undefined');
  }

  const result = await symptoms.getSymptomLogs(symptomId, limit);

  if (!isArray(result)) {
    reportViolation(MODULE_SYMPTOMS, 'getSymptomLogs', 'return_array', result, 'array', 'post');
  }

  for (let i = 0; i < result.length; i++) {
    const log = result[i];
    if (!isInRange(log.severity, 1, 5)) {
      reportViolation(MODULE_SYMPTOMS, 'getSymptomLogs', `result[${i}].severity_in_range`, log.severity, 'number between 1 and 5', 'post');
    }
  }

  return result;
};

export const instrumentedGetSymptomStats = async (
  symptomId: number
): Promise<{ totalLogs: number; averageSeverity: number; lastLogged: number | null } | null> => {
  if (!isValidId(symptomId)) {
    reportViolation(MODULE_SYMPTOMS, 'getSymptomStats', 'symptom_id_valid', symptomId, 'positive integer');
  }

  const result = await symptoms.getSymptomStats(symptomId);

  if (result !== null) {
    if (!isNonNegativeNumber(result.totalLogs)) {
      reportViolation(MODULE_SYMPTOMS, 'getSymptomStats', 'totalLogs_non_negative', result.totalLogs, 'non-negative number', 'post');
    }
    if (!isNonNegativeNumber(result.averageSeverity)) {
      reportViolation(MODULE_SYMPTOMS, 'getSymptomStats', 'averageSeverity_non_negative', result.averageSeverity, 'non-negative number', 'post');
    }
    if (result.averageSeverity > 5) {
      reportViolation(MODULE_SYMPTOMS, 'getSymptomStats', 'averageSeverity_max_5', result.averageSeverity, 'number <= 5', 'post');
    }
  }

  return result;
};

export const instrumentedSaveCognitiveTestResult = async (
  testType: 'reflexes' | 'memory' | 'judgment' | 'rock_dodger' | 'pattern_matcher' | 'tile_puzzle' | 'n_back',
  score: number,
  rawData?: any,
  completionTime?: number,
  studyId?: number,
  supplementLogId?: number,
  accuracy?: number,
  speed?: number
): Promise<number> => {
  if (!isValidTestType(testType)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'test_type_valid', testType, 'valid test type');
  }
  if (!isNonNegativeNumber(score)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'score_non_negative', score, 'non-negative number');
  }
  if (accuracy !== undefined && !isInRange(accuracy, 0, 100)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'accuracy_in_range', accuracy, 'number between 0 and 100');
  }
  if (speed !== undefined && !isNonNegativeNumber(speed)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'speed_non_negative', speed, 'non-negative number');
  }
  if (completionTime !== undefined && !isPositiveNumber(completionTime)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'completion_time_positive', completionTime, 'positive number');
  }
  if (studyId !== undefined && !isValidId(studyId)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'study_id_valid', studyId, 'positive integer or undefined');
  }
  if (supplementLogId !== undefined && !isValidId(supplementLogId)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'supplement_log_id_valid', supplementLogId, 'positive integer or undefined');
  }

  const result = await cognitiveTests.saveCognitiveTestResult(
    testType, score, rawData, completionTime, studyId, supplementLogId, accuracy, speed
  );

  if (!isValidId(result)) {
    reportViolation(MODULE_COGNITIVE, 'saveCognitiveTestResult', 'return_valid_id', result, 'positive integer ID', 'post');
  }

  return result;
};

export const instrumentedGetCognitiveTestResults = async (
  testType?: 'reflexes' | 'memory' | 'judgment' | 'rock_dodger' | 'pattern_matcher' | 'tile_puzzle' | 'n_back',
  limit?: number
): Promise<cognitiveTests.CognitiveTestResult[]> => {
  if (testType !== undefined && !isValidTestType(testType)) {
    reportViolation(MODULE_COGNITIVE, 'getCognitiveTestResults', 'test_type_valid', testType, 'valid test type or undefined');
  }
  if (limit !== undefined && !isPositiveNumber(limit)) {
    reportViolation(MODULE_COGNITIVE, 'getCognitiveTestResults', 'limit_positive', limit, 'positive number or undefined');
  }

  const result = await cognitiveTests.getCognitiveTestResults(testType, limit);

  if (!isArray(result)) {
    reportViolation(MODULE_COGNITIVE, 'getCognitiveTestResults', 'return_array', result, 'array', 'post');
  }

  for (let i = 0; i < result.length; i++) {
    const r = result[i];
    if (!isValidId(r.id)) {
      reportViolation(MODULE_COGNITIVE, 'getCognitiveTestResults', `result[${i}].id_valid`, r.id, 'positive integer', 'post');
    }
    if (!isValidTestType(r.test_type)) {
      reportViolation(MODULE_COGNITIVE, 'getCognitiveTestResults', `result[${i}].test_type_valid`, r.test_type, 'valid test type', 'post');
    }
    if (!isNonNegativeNumber(r.score)) {
      reportViolation(MODULE_COGNITIVE, 'getCognitiveTestResults', `result[${i}].score_non_negative`, r.score, 'non-negative number', 'post');
    }
  }

  return result;
};

export const instrumentedLogSleep = async (
  sleepStart: number,
  sleepEnd: number,
  manuallyEdited: boolean = false
): Promise<number> => {
  if (!isValidTimestamp(sleepStart)) {
    reportViolation(MODULE_SLEEP, 'logSleep', 'sleep_start_valid_timestamp', sleepStart, 'valid unix timestamp');
  }
  if (!isValidTimestamp(sleepEnd)) {
    reportViolation(MODULE_SLEEP, 'logSleep', 'sleep_end_valid_timestamp', sleepEnd, 'valid unix timestamp');
  }
  if (sleepEnd <= sleepStart) {
    reportViolation(MODULE_SLEEP, 'logSleep', 'sleep_end_after_start', { sleepStart, sleepEnd }, 'sleepEnd > sleepStart');
  }

  const result = await sleep.logSleep(sleepStart, sleepEnd, manuallyEdited);

  if (!isValidId(result)) {
    reportViolation(MODULE_SLEEP, 'logSleep', 'return_valid_id', result, 'positive integer ID', 'post');
  }

  return result;
};

export const instrumentedGetSleepLogs = async (
  limit?: number
): Promise<sleep.SleepLog[]> => {
  if (limit !== undefined && !isPositiveNumber(limit)) {
    reportViolation(MODULE_SLEEP, 'getSleepLogs', 'limit_positive', limit, 'positive number or undefined');
  }

  const result = await sleep.getSleepLogs(limit);

  if (!isArray(result)) {
    reportViolation(MODULE_SLEEP, 'getSleepLogs', 'return_array', result, 'array', 'post');
  }

  for (let i = 0; i < result.length; i++) {
    const log = result[i];
    if (!isValidId(log.id)) {
      reportViolation(MODULE_SLEEP, 'getSleepLogs', `result[${i}].id_valid`, log.id, 'positive integer', 'post');
    }
    if (!log.didnt_sleep && log.sleep_end !== null && log.sleep_start !== null) {
      if (log.sleep_end <= log.sleep_start) {
        reportViolation(MODULE_SLEEP, 'getSleepLogs', `result[${i}].sleep_end_after_start`, { sleep_start: log.sleep_start, sleep_end: log.sleep_end }, 'sleep_end > sleep_start', 'post');
      }
      const expectedDuration = log.sleep_end - log.sleep_start;
      if (log.duration_seconds !== expectedDuration) {
        reportViolation(MODULE_SLEEP, 'getSleepLogs', `result[${i}].duration_consistency`, { duration_seconds: log.duration_seconds, expected: expectedDuration }, 'duration_seconds === sleep_end - sleep_start', 'post');
      }
    }
  }

  return result;
};

export const instrumentedUpdateSleepLog = async (
  id: number,
  sleepStart: number,
  sleepEnd: number
): Promise<void> => {
  if (!isValidId(id)) {
    reportViolation(MODULE_SLEEP, 'updateSleepLog', 'id_valid', id, 'positive integer');
  }
  if (!isValidTimestamp(sleepStart)) {
    reportViolation(MODULE_SLEEP, 'updateSleepLog', 'sleep_start_valid_timestamp', sleepStart, 'valid unix timestamp');
  }
  if (!isValidTimestamp(sleepEnd)) {
    reportViolation(MODULE_SLEEP, 'updateSleepLog', 'sleep_end_valid_timestamp', sleepEnd, 'valid unix timestamp');
  }
  if (sleepEnd <= sleepStart) {
    reportViolation(MODULE_SLEEP, 'updateSleepLog', 'sleep_end_after_start', { sleepStart, sleepEnd }, 'sleepEnd > sleepStart');
  }

  return sleep.updateSleepLog(id, sleepStart, sleepEnd);
};

export const instrumentedGetLastSleepLog = async (): Promise<sleep.SleepLog | null> => {
  const result = await sleep.getLastSleepLog();

  if (result !== null) {
    if (!isValidId(result.id)) {
      reportViolation(MODULE_SLEEP, 'getLastSleepLog', 'result.id_valid', result.id, 'positive integer', 'post');
    }
    if (!result.didnt_sleep && result.sleep_end !== null && result.sleep_start !== null) {
      if (result.sleep_end <= result.sleep_start) {
        reportViolation(MODULE_SLEEP, 'getLastSleepLog', 'result.sleep_end_after_start', { sleep_start: result.sleep_start, sleep_end: result.sleep_end }, 'sleep_end > sleep_start', 'post');
      }
    }
  }

  return result;
};

export {
  getViolations,
  clearViolations,
  getReport,
  enableReporting,
  disableReporting,
} from './db-invariants';
