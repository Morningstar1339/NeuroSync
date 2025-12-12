type InvariantViolation = {
  module: string;
  function: string;
  invariant: string;
  actual: any;
  expected: string;
  timestamp: number;
  stack?: string;
  phase: 'pre' | 'post';
};

type InvariantReportSummary = {
  totalViolations: number;
  byModule: Record<string, number>;
  byInvariant: Record<string, number>;
  violations: InvariantViolation[];
};

const violations: InvariantViolation[] = [];
let reportingEnabled = true;

export const enableReporting = () => { reportingEnabled = true; };
export const disableReporting = () => { reportingEnabled = false; };

export const reportViolation = (
  module: string,
  func: string,
  invariant: string,
  actual: any,
  expected: string,
  phase: 'pre' | 'post' = 'pre'
): void => {
  const violation: InvariantViolation = {
    module,
    function: func,
    invariant,
    actual,
    expected,
    timestamp: Date.now(),
    stack: new Error().stack?.split('\n').slice(2).join('\n'),
    phase,
  };
  
  violations.push(violation);
  
  if (reportingEnabled) {
    console.error(
      `[INVARIANT VIOLATION] ${module}.${func} (${phase})\n` +
      `  Invariant: ${invariant}\n` +
      `  Expected: ${expected}\n` +
      `  Actual: ${JSON.stringify(actual)}\n` +
      `  Stack: ${violation.stack?.split('\n')[0] || 'unknown'}`
    );
  }
};

export const getViolations = (): InvariantViolation[] => [...violations];

export const clearViolations = (): void => {
  violations.length = 0;
};

export const getReport = (): InvariantReportSummary => {
  const byModule: Record<string, number> = {};
  const byInvariant: Record<string, number> = {};
  
  for (const v of violations) {
    byModule[v.module] = (byModule[v.module] || 0) + 1;
    byInvariant[v.invariant] = (byInvariant[v.invariant] || 0) + 1;
  }
  
  return {
    totalViolations: violations.length,
    byModule,
    byInvariant,
    violations: [...violations],
  };
};

export const isNonEmptyString = (val: any): val is string => 
  typeof val === 'string' && val.trim().length > 0;

export const isPositiveNumber = (val: any): val is number => 
  typeof val === 'number' && !isNaN(val) && val > 0;

export const isNonNegativeNumber = (val: any): val is number => 
  typeof val === 'number' && !isNaN(val) && val >= 0;

export const isValidId = (val: any): val is number => 
  typeof val === 'number' && Number.isInteger(val) && val > 0;

export const isInRange = (val: any, min: number, max: number): boolean => 
  typeof val === 'number' && !isNaN(val) && val >= min && val <= max;

export const isValidTimestamp = (val: any): boolean => 
  typeof val === 'number' && Number.isInteger(val) && val > 0 && val < 4102444800;

export const isValidHexColor = (val: any): boolean => 
  typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val);

export const isValidBodyRegion = (val: any): boolean => 
  ['head', 'thorax', 'abdomen', 'pelvis', 'arms', 'hands', 'legs', 'feet'].includes(val);

export const isValidTestType = (val: any): boolean => 
  ['reflexes', 'memory', 'judgment', 'rock_dodger', 'pattern_matcher', 'tile_puzzle', 'n_back'].includes(val);

export const isValidNotificationType = (val: any): boolean => 
  ['supplement_reminder', 'study_protocol', 'sleep_reminder'].includes(val);

export const isValidExclusionType = (val: any): boolean => 
  ['time_window', 'dosage_limit'].includes(val);

export const isValidScheduleType = (val: any): boolean => 
  ['event_based', 'daily_schedule'].includes(val);

export const isArray = (val: any): val is any[] => Array.isArray(val);

export const isNonNull = <T>(val: T | null | undefined): val is T => 
  val !== null && val !== undefined;
