import {
  clearViolations,
  getViolations,
  getReport,
  reportViolation,
  isValidId,
  isPositiveNumber,
  isNonEmptyString,
  isInRange,
  isValidBodyRegion,
  isValidTestType,
  isValidTimestamp,
  isValidHexColor,
} from '../utils/db-invariants';

import {
  instrumentedAddSupplement,
  instrumentedLogSupplement,
  instrumentedAddSymptom,
  instrumentedLogSymptom,
  instrumentedSaveCognitiveTestResult,
  instrumentedLogSleep,
} from '../utils/instrumented-db';

describe('Invariant Validators', () => {
  describe('isValidId', () => {
    it('accepts positive integers', () => {
      expect(isValidId(1)).toBe(true);
      expect(isValidId(100)).toBe(true);
      expect(isValidId(999999)).toBe(true);
    });

    it('rejects zero, negatives, and non-integers', () => {
      expect(isValidId(0)).toBe(false);
      expect(isValidId(-1)).toBe(false);
      expect(isValidId(1.5)).toBe(false);
      expect(isValidId(NaN)).toBe(false);
      expect(isValidId(null)).toBe(false);
      expect(isValidId(undefined)).toBe(false);
      expect(isValidId('1')).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('accepts positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.001)).toBe(true);
      expect(isPositiveNumber(100.5)).toBe(true);
    });

    it('rejects zero, negatives, and non-numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber(null)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('accepts non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
    });

    it('rejects empty and whitespace-only strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString('\t\n')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isInRange', () => {
    it('accepts values in range', () => {
      expect(isInRange(5, 1, 10)).toBe(true);
      expect(isInRange(1, 1, 10)).toBe(true);
      expect(isInRange(10, 1, 10)).toBe(true);
    });

    it('rejects values outside range', () => {
      expect(isInRange(0, 1, 10)).toBe(false);
      expect(isInRange(11, 1, 10)).toBe(false);
      expect(isInRange(NaN, 1, 10)).toBe(false);
    });
  });

  describe('isValidBodyRegion', () => {
    it('accepts valid body regions', () => {
      expect(isValidBodyRegion('head')).toBe(true);
      expect(isValidBodyRegion('thorax')).toBe(true);
      expect(isValidBodyRegion('abdomen')).toBe(true);
      expect(isValidBodyRegion('pelvis')).toBe(true);
      expect(isValidBodyRegion('arms')).toBe(true);
      expect(isValidBodyRegion('hands')).toBe(true);
      expect(isValidBodyRegion('legs')).toBe(true);
      expect(isValidBodyRegion('feet')).toBe(true);
    });

    it('rejects invalid body regions', () => {
      expect(isValidBodyRegion('brain')).toBe(false);
      expect(isValidBodyRegion('HEAD')).toBe(false);
      expect(isValidBodyRegion('')).toBe(false);
      expect(isValidBodyRegion(null)).toBe(false);
    });
  });

  describe('isValidTestType', () => {
    it('accepts valid test types', () => {
      expect(isValidTestType('reflexes')).toBe(true);
      expect(isValidTestType('memory')).toBe(true);
      expect(isValidTestType('judgment')).toBe(true);
      expect(isValidTestType('rock_dodger')).toBe(true);
      expect(isValidTestType('pattern_matcher')).toBe(true);
      expect(isValidTestType('tile_puzzle')).toBe(true);
      expect(isValidTestType('n_back')).toBe(true);
    });

    it('rejects invalid test types', () => {
      expect(isValidTestType('invalid')).toBe(false);
      expect(isValidTestType('MEMORY')).toBe(false);
      expect(isValidTestType('')).toBe(false);
    });
  });

  describe('isValidTimestamp', () => {
    it('accepts valid timestamps', () => {
      expect(isValidTimestamp(1000000000)).toBe(true);
      expect(isValidTimestamp(Math.floor(Date.now() / 1000))).toBe(true);
    });

    it('rejects invalid timestamps', () => {
      expect(isValidTimestamp(0)).toBe(false);
      expect(isValidTimestamp(-1)).toBe(false);
      expect(isValidTimestamp(5000000000)).toBe(false); // year 2128
    });
  });

  describe('isValidHexColor', () => {
    it('accepts valid hex colors', () => {
      expect(isValidHexColor('#007AFF')).toBe(true);
      expect(isValidHexColor('#ffffff')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
    });

    it('rejects invalid colors', () => {
      expect(isValidHexColor('007AFF')).toBe(false);
      expect(isValidHexColor('#fff')).toBe(false);
      expect(isValidHexColor('red')).toBe(false);
      expect(isValidHexColor('#GGGGGG')).toBe(false);
    });
  });
});

describe('Violation Reporting', () => {
  beforeEach(() => {
    clearViolations();
  });

  it('records violations correctly', () => {
    reportViolation('test-module', 'testFunc', 'test_invariant', 'bad-value', 'good-value');
    
    const violations = getViolations();
    expect(violations).toHaveLength(1);
    expect(violations[0].module).toBe('test-module');
    expect(violations[0].function).toBe('testFunc');
    expect(violations[0].invariant).toBe('test_invariant');
    expect(violations[0].actual).toBe('bad-value');
    expect(violations[0].expected).toBe('good-value');
    expect(violations[0].stack).toBeDefined();
  });

  it('generates correct report', () => {
    reportViolation('mod1', 'func1', 'inv1', 'v1', 'e1');
    reportViolation('mod1', 'func2', 'inv2', 'v2', 'e2');
    reportViolation('mod2', 'func3', 'inv1', 'v3', 'e3');
    
    const report = getReport();
    expect(report.totalViolations).toBe(3);
    expect(report.byModule['mod1']).toBe(2);
    expect(report.byModule['mod2']).toBe(1);
    expect(report.byInvariant['inv1']).toBe(2);
    expect(report.byInvariant['inv2']).toBe(1);
  });

  it('clears violations', () => {
    reportViolation('mod', 'func', 'inv', 'v', 'e');
    expect(getViolations()).toHaveLength(1);
    
    clearViolations();
    expect(getViolations()).toHaveLength(0);
  });
});

describe('Instrumented Database Functions', () => {
  beforeEach(() => {
    clearViolations();
  });

  describe('Supplements - Valid Inputs', () => {
    it('addSupplement with valid data creates no violations', async () => {
      const id = await instrumentedAddSupplement({
        name: 'Vitamin D',
        default_dosage: 1000,
        dosage_unit: 'IU',
        schedule_enabled: false,
        study_enabled: false,
      });
      
      expect(id).toBeGreaterThan(0);
      expect(getViolations()).toHaveLength(0);
    });

    it('addSupplement with valid color creates no violations', async () => {
      const id = await instrumentedAddSupplement({
        name: 'Magnesium',
        default_dosage: 400,
        dosage_unit: 'mg',
        color: '#FF5733',
        schedule_enabled: true,
        study_enabled: false,
      });
      
      expect(id).toBeGreaterThan(0);
      expect(getViolations()).toHaveLength(0);
    });
  });

  describe('Supplements - Invalid Inputs', () => {
    it('addSupplement with empty name triggers violation', async () => {
      try {
        await instrumentedAddSupplement({
          name: '',
          default_dosage: 100,
          dosage_unit: 'mg',
          schedule_enabled: false,
          study_enabled: false,
        });
      } catch (e) {
        // Expected to throw
      }
      
      const violations = getViolations();
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.invariant === 'name_non_empty')).toBe(true);
    });

    it('addSupplement with zero dosage triggers violation', async () => {
      try {
        await instrumentedAddSupplement({
          name: 'Test',
          default_dosage: 0,
          dosage_unit: 'mg',
          schedule_enabled: false,
          study_enabled: false,
        });
      } catch (e) {
        // Expected to throw
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'default_dosage_positive')).toBe(true);
    });

    it('addSupplement with negative dosage triggers violation', async () => {
      try {
        await instrumentedAddSupplement({
          name: 'Test',
          default_dosage: -50,
          dosage_unit: 'mg',
          schedule_enabled: false,
          study_enabled: false,
        });
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'default_dosage_positive')).toBe(true);
    });

    it('addSupplement with invalid color triggers violation', async () => {
      try {
        await instrumentedAddSupplement({
          name: 'Test Supplement',
          default_dosage: 100,
          dosage_unit: 'mg',
          color: 'not-a-color',
          schedule_enabled: false,
          study_enabled: false,
        });
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'color_hex_format')).toBe(true);
    });

    it('logSupplement with invalid supplement ID triggers violation', async () => {
      try {
        await instrumentedLogSupplement(-1, 100);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'supplement_id_valid')).toBe(true);
    });

    it('logSupplement with zero dosage triggers violation', async () => {
      try {
        await instrumentedLogSupplement(1, 0);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'dosage_positive')).toBe(true);
    });
  });

  describe('Symptoms - Invalid Inputs', () => {
    it('addSymptom with invalid body region triggers violation', async () => {
      try {
        await instrumentedAddSymptom('invalid_region' as any, 'Test symptom');
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'body_region_valid')).toBe(true);
    });

    it('addSymptom with empty description triggers violation', async () => {
      try {
        await instrumentedAddSymptom('head', '');
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'description_non_empty')).toBe(true);
    });

    it('logSymptom with severity 0 triggers violation', async () => {
      try {
        await instrumentedLogSymptom(1, 0);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'severity_in_range')).toBe(true);
    });

    it('logSymptom with severity 10 triggers violation', async () => {
      try {
        await instrumentedLogSymptom(1, 10);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'severity_in_range')).toBe(true);
    });
  });

  describe('Cognitive Tests - Invalid Inputs', () => {
    it('saveCognitiveTestResult with invalid test type triggers violation', async () => {
      try {
        await instrumentedSaveCognitiveTestResult('invalid_test' as any, 50);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'test_type_valid')).toBe(true);
    });

    it('saveCognitiveTestResult with negative score triggers violation', async () => {
      try {
        await instrumentedSaveCognitiveTestResult('memory', -100);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'score_non_negative')).toBe(true);
    });

    it('saveCognitiveTestResult with accuracy > 100 triggers violation', async () => {
      try {
        await instrumentedSaveCognitiveTestResult('memory', 50, undefined, undefined, undefined, undefined, 150);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'accuracy_in_range')).toBe(true);
    });

    it('saveCognitiveTestResult with valid inputs creates no violations', async () => {
      const id = await instrumentedSaveCognitiveTestResult('memory', 85, undefined, 5000, undefined, undefined, 90, 500);
      
      expect(id).toBeGreaterThan(0);
      expect(getViolations()).toHaveLength(0);
    });
  });

  describe('Sleep - Invalid Inputs', () => {
    it('logSleep with end before start triggers violation', async () => {
      const now = Math.floor(Date.now() / 1000);
      try {
        await instrumentedLogSleep(now, now - 3600);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'sleep_end_after_start')).toBe(true);
    });

    it('logSleep with negative timestamp triggers violation', async () => {
      try {
        await instrumentedLogSleep(-1000, 1000);
      } catch (e) {
        // Expected
      }
      
      const violations = getViolations();
      expect(violations.some(v => v.invariant === 'sleep_start_valid_timestamp')).toBe(true);
    });

    it('logSleep with valid inputs creates no violations', async () => {
      const now = Math.floor(Date.now() / 1000);
      const sleepStart = now - 28800; // 8 hours ago
      const sleepEnd = now;
      
      const id = await instrumentedLogSleep(sleepStart, sleepEnd);
      
      expect(id).toBeGreaterThan(0);
      expect(getViolations()).toHaveLength(0);
    });
  });
});

describe('Summary Report', () => {
  beforeEach(() => {
    clearViolations();
  });

  it('generates comprehensive summary after multiple violations', async () => {
    // Trigger various violations
    try { await instrumentedAddSupplement({ name: '', default_dosage: -1, dosage_unit: '', schedule_enabled: false, study_enabled: false }); } catch (e) {}
    try { await instrumentedLogSymptom(-1, 0); } catch (e) {}
    try { await instrumentedSaveCognitiveTestResult('invalid' as any, -10); } catch (e) {}
    try { await instrumentedLogSleep(-1, -2); } catch (e) {}
    
    const report = getReport();
    
    console.log('\n========== INVARIANT VIOLATION REPORT ==========');
    console.log(`Total violations: ${report.totalViolations}`);
    console.log('\nBy module:');
    Object.entries(report.byModule).forEach(([mod, count]) => {
      console.log(`  ${mod}: ${count}`);
    });
    console.log('\nBy invariant:');
    Object.entries(report.byInvariant).forEach(([inv, count]) => {
      console.log(`  ${inv}: ${count}`);
    });
    console.log('\nDetailed violations:');
    report.violations.forEach((v, i) => {
      console.log(`\n${i + 1}. [${v.phase}] ${v.module}.${v.function}`);
      console.log(`   Invariant: ${v.invariant}`);
      console.log(`   Expected: ${v.expected}`);
      console.log(`   Actual: ${JSON.stringify(v.actual)}`);
    });
    console.log('\n=================================================\n');
    
    expect(report.totalViolations).toBeGreaterThan(0);
    expect(Object.keys(report.byModule).length).toBeGreaterThan(0);
  });
});
