import type { LoginCredentials, RegisterInput } from './auth.types';

export type LoginErrors = Partial<Record<keyof LoginCredentials, string>>;

export function validateLogin(values: LoginCredentials): LoginErrors {
  const errors: LoginErrors = {};
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Please enter a valid email address.';
  if (!values.password) errors.password = 'Password is required.';
  return errors;
}

export type RegisterErrors = Partial<Record<keyof RegisterInput, string>>;

export function validateRegister(values: RegisterInput): RegisterErrors {
  const errors: RegisterErrors = {};
  if (values.name.trim().length < 2) errors.name = 'Please enter your full name.';
  if (!values.email.trim()) errors.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Please enter a valid email address.';
  if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) errors.password = 'Use at least one letter and one number.';
  if (!values.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (!values.acceptedTerms) errors.acceptedTerms = 'You must agree to the Terms and Privacy Policy.';
  return errors;
}
