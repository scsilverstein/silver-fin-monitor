// Validation utilities for Silver Fin Monitor

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  // At least 8 characters, contain letters, numbers, and special characters
  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const validateApiKey = (apiKey: string): boolean => {
  // Silver Fin Monitor API keys start with 'sfm_' followed by 32 characters
  const apiKeyRegex = /^sfm_[A-Za-z0-9]{32}$/;
  return apiKeyRegex.test(apiKey);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateSubscriptionTier = (tier: string): boolean => {
  return ['free', 'professional', 'enterprise'].includes(tier);
};

export const validateRole = (role: string): boolean => {
  return ['user', 'admin'].includes(role);
};