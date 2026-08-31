export type InteractionSafety = 'SAFE' | 'READ_ONLY' | 'POTENTIALLY_DESTRUCTIVE' | 'DESTRUCTIVE' | 'UNKNOWN';
export type InteractionKind = 'button' | 'links-as-controls' | 'menus' | 'tabs' | 'accordions' | 'dialogs' | 'basic-form-validation' | 'covered-controls' | 'disabled-controls';

export interface InteractionCandidate {
  ref: string; selector: string; tagName: string; role?: string; type?: string; textPreview: string; accessibleName: string;
  href?: string; disabled: boolean; ariaDisabled: boolean; ariaExpanded?: string; ariaSelected?: string; ariaControls?: string;
  visible: boolean; covered: boolean; rect: { x: number; y: number; width: number; height: number }; safety: InteractionSafety;
  kind: InteractionKind;
}

const dangerous = /\b(delete|remove|destroy|purchase|buy|checkout|pay|place\s+order|confirm\s+order|send\s+money|transfer|subscribe|unsubscribe|cancel\s+subscription|close\s+account|deactivate|log\s*out|sign\s*out|publish|deploy|merge|approve|book|reserve|upload|download\s+(?:an?\s+)?(?:file|executable)|reset\s+(?:production|data))\b/i;
const readonly = /\b(open|show|view|details|menu|tab|accordion|expand|collapse|next|previous|learn\s+more)\b/i;

export function classifyInteraction(input: Pick<InteractionCandidate, 'textPreview' | 'accessibleName' | 'href' | 'role' | 'type'>): InteractionSafety {
  if (input.type === 'submit' || input.type === 'reset') return 'POTENTIALLY_DESTRUCTIVE';
  const text = [input.textPreview, input.accessibleName, input.href, input.role, input.type].filter(Boolean).join(' ');
  if (dangerous.test(text)) return /\b(delete|destroy|purchase|buy|pay|send\s+money|transfer|close\s+account|deactivate|log\s*out|sign\s*out)\b/i.test(text) ? 'DESTRUCTIVE' : 'POTENTIALLY_DESTRUCTIVE';
  if (readonly.test(text)) return 'READ_ONLY';
  if (!text.trim()) return 'UNKNOWN';
  return 'SAFE';
}

export function isSelectedInteraction(kind: InteractionKind, checks: string[]): boolean {
  return checks.includes(kind);
}
