import type { CustomCheckDefinition, CustomCheckExpected, CustomCheckOperator, CustomCheckResult, PerformanceSnapshot } from '@visionqa/contracts';

export const CUSTOM_CHECK_LIMITS = { maxNameLength: 120, maxDescriptionLength: 500, maxSelectorLength: 300, maxExpectedStringLength: 500, maxChecksPerProject: 100, maxChecksPerScan: 25, maxDomMatchesPerCheck: 100, maxFindingsPerCheckPage: 10 } as const;
const operators = new Set<CustomCheckOperator>(['EXISTS', 'NOT_EXISTS', 'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL', 'COUNT_EQUALS', 'COUNT_GREATER_THAN', 'COUNT_LESS_THAN', 'VISIBLE', 'HIDDEN', 'ENABLED', 'DISABLED']);
const targetTypes = new Set(['DOM', 'TEXT', 'ATTRIBUTE', 'HTTP', 'METADATA', 'BROWSER', 'PERFORMANCE']);
const numericOperators = new Set(['GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL', 'COUNT_EQUALS', 'COUNT_GREATER_THAN', 'COUNT_LESS_THAN']);
const stringOperators = new Set(['CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH']);

export interface CustomCheckValidation { valid: boolean; errors: string[] }
export function validateCustomCheckDefinition(definition: CustomCheckDefinition): CustomCheckValidation {
  const errors: string[] = [];
  if (!definition || !targetTypes.has(definition.targetType)) errors.push('Select a supported target.');
  if (!definition?.source || typeof definition.source !== 'string' || definition.source.length > 100) errors.push('Select a supported property.');
  if (!definition?.operator || !operators.has(definition.operator)) errors.push('Select a supported operator.');
  if (['DOM', 'TEXT', 'ATTRIBUTE'].includes(definition?.targetType) && (!definition.selector || definition.selector.length > CUSTOM_CHECK_LIMITS.maxSelectorLength)) errors.push('Enter a valid CSS selector up to 300 characters.');
  if (definition?.selector?.length && !isSafeCssSelector(definition.selector)) errors.push('Enter a valid CSS selector.');
  if (definition?.expected !== undefined && typeof definition.expected === 'string' && definition.expected.length > CUSTOM_CHECK_LIMITS.maxExpectedStringLength) errors.push('Expected text is too long.');
  if (definition?.operator && numericOperators.has(definition.operator) && typeof definition.expected !== 'number') errors.push('This operator requires a numeric value.');
  if (definition?.operator && stringOperators.has(definition.operator) && typeof definition.expected !== 'string') errors.push('This operator requires a text value.');
  if (definition?.targetType === 'PERFORMANCE' && (!['GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL'].includes(definition.operator))) errors.push('Choose a numeric performance comparison.');
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function isSafeCssSelector(selector: string): boolean { if (!selector.trim() || /[{};]/.test(selector)) return false; let depth = 0; for (const character of selector) { if (character === '[') depth++; if (character === ']') depth--; if (depth < 0) return false; } return depth === 0; }
type DomElementFact = { ref: string; selector: string; text?: string; visible?: boolean; enabled?: boolean; attributes?: Record<string, string> };
export interface CustomEvaluationContext { dom?: { elements: DomElementFact[] }; http?: { status?: number; headers?: Record<string, string>; contentType?: string; durationMs?: number }; metadata?: Record<string, string | string[] | undefined>; browser?: { consoleErrorCount: number; pageErrorCount: number; failedRequestCount: number; httpErrorCount: number }; performance?: PerformanceSnapshot }

function compare(actual: CustomCheckExpected | null, operator: CustomCheckOperator, expected?: CustomCheckExpected): boolean {
  if (operator === 'EXISTS') return actual !== null;
  if (operator === 'NOT_EXISTS') return actual === null;
  if (operator === 'VISIBLE' || operator === 'ENABLED') return actual === true;
  if (operator === 'HIDDEN' || operator === 'DISABLED') return actual === false;
  if (actual === null || expected === undefined) return false;
  if (operator === 'EQUALS' || operator === 'COUNT_EQUALS') return actual === expected;
  if (operator === 'NOT_EQUALS') return actual !== expected;
  if (typeof actual === 'string' && typeof expected === 'string') { if (operator === 'CONTAINS') return actual.includes(expected); if (operator === 'NOT_CONTAINS') return !actual.includes(expected); if (operator === 'STARTS_WITH') return actual.startsWith(expected); if (operator === 'ENDS_WITH') return actual.endsWith(expected); }
  if (typeof actual === 'number' && typeof expected === 'number') { if (operator === 'GREATER_THAN' || operator === 'COUNT_GREATER_THAN') return actual > expected; if (operator === 'GREATER_OR_EQUAL') return actual >= expected; if (operator === 'LESS_THAN' || operator === 'COUNT_LESS_THAN') return actual < expected; if (operator === 'LESS_OR_EQUAL') return actual <= expected; }
  return false;
}
function makeResult(status: CustomCheckResult['status'], actual: CustomCheckExpected | null, expected: CustomCheckExpected | null, message: string, pageUrl: string): Omit<CustomCheckResult, 'customCheckId' | 'scanId'> { return { pageUrl, status, actual, expected, message, evaluatedAt: new Date().toISOString() }; }
export function evaluateCustomCheck(definition: CustomCheckDefinition, context: CustomEvaluationContext, pageUrl = ''): Omit<CustomCheckResult, 'customCheckId' | 'scanId'> {
  const validation = validateCustomCheckDefinition(definition); if (!validation.valid) return makeResult('ERROR', null, definition.expected ?? null, validation.errors.join(' '), pageUrl);
  try {
    let actual: CustomCheckExpected | null = null;
    const source = definition.source;
    if (['DOM', 'TEXT', 'ATTRIBUTE'].includes(definition.targetType)) { const matches = (context.dom?.elements ?? []).filter((element) => !definition.selector || element.selector === definition.selector).slice(0, CUSTOM_CHECK_LIMITS.maxDomMatchesPerCheck); if (source === 'count') actual = matches.length; else if (source === 'visible') actual = matches[0]?.visible ?? null; else if (source === 'enabled') actual = matches[0]?.enabled ?? null; else if (source === 'attribute') actual = matches[0]?.attributes?.[definition.property ?? ''] ?? null; else actual = matches[0]?.text ?? null; }
    else if (definition.targetType === 'HTTP') { const http = context.http; actual = source === 'status' ? http?.status ?? null : source === 'duration' ? http?.durationMs ?? null : source === 'content-type' ? http?.contentType ?? null : http?.headers?.[definition.property ?? ''] ?? null; }
    else if (definition.targetType === 'METADATA') { const metadata = context.metadata?.[source]; actual = Array.isArray(metadata) ? metadata.slice(0, 10).join(', ').slice(0, 500) : metadata ?? null; }
    else if (definition.targetType === 'BROWSER') { const browser = context.browser; actual = browser ? ({ consoleErrors: browser.consoleErrorCount, pageErrors: browser.pageErrorCount, failedRequests: browser.failedRequestCount, httpErrors: browser.httpErrorCount } as Record<string, number>)[source] ?? null : null; }
    else if (definition.targetType === 'PERFORMANCE') { const performance = context.performance; const metric = source === 'ttfb' ? performance?.navigation.ttfbMs : source === 'fcp' ? performance?.webVitals.fcpMs : source === 'lcp' ? performance?.webVitals.lcpMs : source === 'cls' ? performance?.webVitals.cls : source === 'load' ? performance?.navigation.loadMs : source === 'request-count' ? performance?.network.requestCount : source === 'transfer-bytes' ? performance?.network.transferredBytes : null; if (metric === null || metric === undefined) return makeResult('SKIPPED', null, definition.expected ?? null, `Metric ${source} is unavailable.`, pageUrl); actual = metric; }
    const passed = compare(actual, definition.operator, definition.expected); return makeResult(passed ? 'PASS' : 'FAIL', actual, definition.expected ?? null, passed ? 'Custom check passed.' : `Expected ${String(definition.expected ?? definition.operator)} but found ${String(actual)}.`, pageUrl);
  } catch { return makeResult('ERROR', null, definition.expected ?? null, 'The custom check could not be evaluated safely.', pageUrl); }
}
export function customCheckRuleSummary(definition: CustomCheckDefinition): string { return `${definition.targetType}: ${definition.source}${definition.selector ? ` (${definition.selector})` : ''} ${definition.operator}${definition.expected !== undefined ? ` ${String(definition.expected)}` : ''}`; }
