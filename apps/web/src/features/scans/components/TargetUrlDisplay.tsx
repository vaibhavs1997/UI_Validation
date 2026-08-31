'use client';

import { useState } from 'react';

export function TargetUrlDisplay({ url, className = '' }: { url?: string | null | undefined; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!url) return <span className={className}>Target unavailable</span>;
  let host = url;
  let path = '';
  let displayUrl = url;
  try { const parsed = new URL(url); for (const key of ['token', 'api_key', 'apikey', 'password', 'signature', 'access_token']) if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '••••'); displayUrl = parsed.toString(); host = parsed.host; path = `${parsed.pathname}${parsed.search}`; } catch { /* Keep the raw value for legacy records. */ }
  const copy = async () => { await navigator.clipboard?.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  return <span className={`target-url-display ${className}`} title={displayUrl}><span><strong>{host}</strong>{path && <small>{path}</small>}</span><button type="button" aria-label="Copy target URL" onClick={(event) => { event.preventDefault(); void copy(); }}>{copied ? 'Copied' : 'Copy'}</button><a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} aria-label="Open target URL">↗</a></span>;
}
