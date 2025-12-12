import { GeneratedValue } from './fuzz-generators';
import {
  clearViolations,
  getViolations,
  disableReporting,
  enableReporting,
} from './db-invariants';

export type FuzzResult = {
  functionName: string;
  inputDescription: string;
  inputCategory: string;
  inputs: any[];
  outcome: 'success' | 'violation' | 'exception';
  violations: string[];
  error?: string;
  unexpected: boolean;
};

export type FuzzSummary = {
  totalRuns: number;
  successes: number;
  violations: number;
  exceptions: number;
  unexpectedSuccesses: FuzzResult[];
  unexpectedFailures: FuzzResult[];
  byFunction: Record<string, { total: number; violations: number; exceptions: number }>;
  byCategory: Record<string, { total: number; violations: number; exceptions: number }>;
  coverageStats: {
    functionsTesd: number;
    inputCategoriesTested: string[];
    violationTypes: string[];
  };
};

export type FuzzableFunction = {
  name: string;
  fn: (...args: any[]) => Promise<any>;
  inputGenerators: (() => GeneratedValue<any>[])[];
  expectValidFor: (inputs: any[]) => boolean;
};

const cartesianProduct = <T>(arrays: T[][]): T[][] => {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  return first.flatMap(item => restProduct.map(combo => [item, ...combo]));
};

export const runFuzzer = async (
  functions: FuzzableFunction[],
  options: { maxCombinations?: number; verbose?: boolean } = {}
): Promise<{ results: FuzzResult[]; summary: FuzzSummary }> => {
  const { maxCombinations = 500, verbose = false } = options;
  const results: FuzzResult[] = [];

  disableReporting();

  for (const funcDef of functions) {
    const generatedInputs = funcDef.inputGenerators.map(gen => gen());
    let combinations = cartesianProduct(generatedInputs);

    if (combinations.length > maxCombinations) {
      combinations = combinations.slice(0, maxCombinations);
    }

    for (const combo of combinations) {
      const inputs = combo.map(g => g.value);
      const categories = combo.map(g => g.category);
      const descriptions = combo.map(g => g.description);
      const inputCategory = categories.includes('malformed') ? 'malformed'
        : categories.includes('invalid') ? 'invalid'
        : categories.includes('edge') ? 'edge'
        : 'valid';

      const shouldBeValid = funcDef.expectValidFor(inputs);

      clearViolations();

      let outcome: 'success' | 'violation' | 'exception' = 'success';
      let error: string | undefined;
      let violations: string[] = [];

      try {
        await funcDef.fn(...inputs);
        violations = getViolations().map(v => v.invariant);
        if (violations.length > 0) {
          outcome = 'violation';
        }
      } catch (e) {
        outcome = 'exception';
        error = e instanceof Error ? e.message : String(e);
        violations = getViolations().map(v => v.invariant);
      }

      const unexpected = (shouldBeValid && outcome !== 'success') ||
                         (!shouldBeValid && outcome === 'success' && violations.length === 0);

      const result: FuzzResult = {
        functionName: funcDef.name,
        inputDescription: descriptions.join(', '),
        inputCategory,
        inputs,
        outcome,
        violations,
        error,
        unexpected,
      };

      results.push(result);

      if (verbose && unexpected) {
        console.log(`[UNEXPECTED] ${funcDef.name}(${descriptions.join(', ')}): ${outcome}`);
      }
    }
  }

  enableReporting();

  const summary = generateSummary(results, functions.length);
  return { results, summary };
};

const generateSummary = (results: FuzzResult[], functionCount: number): FuzzSummary => {
  const byFunction: Record<string, { total: number; violations: number; exceptions: number }> = {};
  const byCategory: Record<string, { total: number; violations: number; exceptions: number }> = {};
  const violationTypes = new Set<string>();
  const categoriesTested = new Set<string>();

  let successes = 0;
  let violations = 0;
  let exceptions = 0;

  for (const r of results) {
    if (!byFunction[r.functionName]) {
      byFunction[r.functionName] = { total: 0, violations: 0, exceptions: 0 };
    }
    byFunction[r.functionName].total++;

    if (!byCategory[r.inputCategory]) {
      byCategory[r.inputCategory] = { total: 0, violations: 0, exceptions: 0 };
    }
    byCategory[r.inputCategory].total++;
    categoriesTested.add(r.inputCategory);

    if (r.outcome === 'success') {
      successes++;
    } else if (r.outcome === 'violation') {
      violations++;
      byFunction[r.functionName].violations++;
      byCategory[r.inputCategory].violations++;
      r.violations.forEach(v => violationTypes.add(v));
    } else {
      exceptions++;
      byFunction[r.functionName].exceptions++;
      byCategory[r.inputCategory].exceptions++;
    }
  }

  return {
    totalRuns: results.length,
    successes,
    violations,
    exceptions,
    unexpectedSuccesses: results.filter(r => r.unexpected && r.outcome === 'success'),
    unexpectedFailures: results.filter(r => r.unexpected && r.outcome !== 'success'),
    byFunction,
    byCategory,
    coverageStats: {
      functionsTesd: functionCount,
      inputCategoriesTested: Array.from(categoriesTested),
      violationTypes: Array.from(violationTypes),
    },
  };
};

export const printSummary = (summary: FuzzSummary): void => {
  console.log('\n' + '='.repeat(60));
  console.log('                    FUZZER SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nTotal runs: ${summary.totalRuns}`);
  console.log(`  Successes:  ${summary.successes} (${(summary.successes / summary.totalRuns * 100).toFixed(1)}%)`);
  console.log(`  Violations: ${summary.violations} (${(summary.violations / summary.totalRuns * 100).toFixed(1)}%)`);
  console.log(`  Exceptions: ${summary.exceptions} (${(summary.exceptions / summary.totalRuns * 100).toFixed(1)}%)`);

  console.log('\n--- By Function ---');
  Object.entries(summary.byFunction).forEach(([fn, stats]) => {
    console.log(`  ${fn}: ${stats.total} runs, ${stats.violations} violations, ${stats.exceptions} exceptions`);
  });

  console.log('\n--- By Input Category ---');
  Object.entries(summary.byCategory).forEach(([cat, stats]) => {
    console.log(`  ${cat}: ${stats.total} runs, ${stats.violations} violations, ${stats.exceptions} exceptions`);
  });

  console.log('\n--- Coverage ---');
  console.log(`  Functions tested: ${summary.coverageStats.functionsTesd}`);
  console.log(`  Categories tested: ${summary.coverageStats.inputCategoriesTested.join(', ')}`);
  console.log(`  Violation types found: ${summary.coverageStats.violationTypes.length}`);
  if (summary.coverageStats.violationTypes.length > 0) {
    summary.coverageStats.violationTypes.forEach(v => console.log(`    - ${v}`));
  }

  if (summary.unexpectedSuccesses.length > 0) {
    console.log('\n--- UNEXPECTED SUCCESSES (invalid data accepted!) ---');
    summary.unexpectedSuccesses.slice(0, 10).forEach(r => {
      console.log(`  ${r.functionName}(${r.inputDescription})`);
      console.log(`    Category: ${r.inputCategory}, Inputs: ${JSON.stringify(r.inputs).slice(0, 100)}`);
    });
    if (summary.unexpectedSuccesses.length > 10) {
      console.log(`  ... and ${summary.unexpectedSuccesses.length - 10} more`);
    }
  }

  if (summary.unexpectedFailures.length > 0) {
    console.log('\n--- UNEXPECTED FAILURES (valid data rejected!) ---');
    summary.unexpectedFailures.slice(0, 10).forEach(r => {
      console.log(`  ${r.functionName}(${r.inputDescription}): ${r.outcome}`);
      if (r.error) console.log(`    Error: ${r.error.slice(0, 100)}`);
      if (r.violations.length) console.log(`    Violations: ${r.violations.join(', ')}`);
    });
    if (summary.unexpectedFailures.length > 10) {
      console.log(`  ... and ${summary.unexpectedFailures.length - 10} more`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (summary.unexpectedSuccesses.length === 0 && summary.unexpectedFailures.length === 0) {
    console.log('All inputs behaved as expected.');
  } else {
    console.log(`ISSUES FOUND: ${summary.unexpectedSuccesses.length} unexpected successes, ${summary.unexpectedFailures.length} unexpected failures`);
  }
  console.log('='.repeat(60) + '\n');
};
