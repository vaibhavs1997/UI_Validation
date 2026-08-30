import { describe, expect, it } from 'vitest';
import { validateProjectInput } from './project.validation';

const valid = { name: 'Marketing site', baseUrl: 'https://example.com', environmentName: 'Production', environmentType: 'production' as const };
describe('project validation', () => {
  it('accepts http and https URLs', () => { expect(validateProjectInput(valid)).toBeNull(); expect(validateProjectInput({ ...valid, baseUrl: 'http://localhost:3000' })).toBeNull(); });
  it('rejects unsupported protocols and missing names', () => { expect(validateProjectInput({ ...valid, baseUrl: 'ftp://example.com' })).toBe('Use an http or https URL.'); expect(validateProjectInput({ ...valid, name: ' ' })).toBe('Enter a project name.'); });
});
