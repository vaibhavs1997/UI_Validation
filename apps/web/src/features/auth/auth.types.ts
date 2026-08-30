export type LoginCredentials = { email: string; password: string };
export type AuthResult = { ok: true } | { ok: false; code: 'invalid_credentials' | 'configuration' | 'auth_not_enabled' | 'session_error' | 'unavailable'; message?: string };

export type RegisterInput = { name: string; email: string; password: string; confirmPassword: string; acceptedTerms: boolean };
export type RegisterResult = { ok: true; user: { id: string; name: string; email: string } } | { ok: false; code: 'duplicate_email' | 'configuration' | 'auth_not_enabled' | 'session_error' | 'unavailable'; message?: string };
