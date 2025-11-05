// Track every single access to the database instance
let accessLog: Array<{
  timestamp: string;
  action: string;
  stackTrace: string;
  dbWasNull: boolean;
  dbIsNull: boolean;
  component?: string;
  details?: string;
}> = [];

export function logDatabaseAccess(action: string, dbBefore: any, dbAfter: any, component?: string, details?: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    stackTrace: new Error().stack || 'no stack',
    dbWasNull: dbBefore === null,
    dbIsNull: dbAfter === null,
    component,
    details
  };
  
  accessLog.push(entry);
  
  // If database went from non-null to null, this is THE BUG
  if (!entry.dbWasNull && entry.dbIsNull) {
    console.error('🔴🔴🔴 DATABASE BECAME NULL 🔴🔴🔴');
    console.error('Action:', action);
    console.error('Timestamp:', entry.timestamp);
    console.error('Stack trace:', entry.stackTrace);
    console.error('Recent access log:');
    console.error(JSON.stringify(accessLog.slice(-10), null, 2));
  }
  
  console.log(`[DB-TRACK] ${action} | before=${!entry.dbWasNull} after=${!entry.dbIsNull}`);
}

export function getDatabaseAccessLog() {
  return accessLog;
}

export function clearAccessLog() {
  accessLog = [];
}

// Enhanced logging functions for more detailed tracking
export function logReactLifecycleEvent(event: string, component: string, details?: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    action: `React Lifecycle: ${event}`,
    stackTrace: new Error().stack || 'no stack',
    dbWasNull: false,
    dbIsNull: false,
    component,
    details: details || `${component} ${event}`
  };
  
  accessLog.push(entry);
  console.log(`[LIFECYCLE] ${component} - ${event}: ${details || ''}`);
}

export function logNavigationEvent(event: string, details?: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    action: `Navigation: ${event}`,
    stackTrace: new Error().stack || 'no stack',
    dbWasNull: false,
    dbIsNull: false,
    component: 'Navigation',
    details: details || event
  };
  
  accessLog.push(entry);
  console.log(`[NAVIGATION] ${event}: ${details || ''}`);
}