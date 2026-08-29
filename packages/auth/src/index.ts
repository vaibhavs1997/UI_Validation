export interface AuthUser {
  id: string;
  email: string;
}
export interface AuthProvider {
  verify(token: string): Promise<AuthUser | null>;
}
