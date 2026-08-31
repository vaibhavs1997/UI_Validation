import { describe, expect, it } from 'vitest';
import { classifyInteraction } from './interactions.js';

describe('classifyInteraction', () => {
  it('allows reversible read-only controls', () => { expect(classifyInteraction({ textPreview: 'Show menu', accessibleName: '', href: '', role: 'button', type: '' })).toBe('READ_ONLY'); });
  it('blocks destructive and session-changing controls', () => { expect(classifyInteraction({ textPreview: 'Delete account', accessibleName: '', href: '', role: 'button', type: '' })).toBe('DESTRUCTIVE'); expect(classifyInteraction({ textPreview: 'Sign out', accessibleName: '', href: '', role: 'button', type: '' })).toBe('DESTRUCTIVE'); });
  it('does not guess for empty semantics', () => { expect(classifyInteraction({ textPreview: '', accessibleName: '', href: '', role: '', type: '' })).toBe('UNKNOWN'); });
});
