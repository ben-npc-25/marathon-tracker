export const appId =
  typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const initialAuthToken =
  typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

export const getSafeAppId = () => appId.replace(/[^a-zA-Z0-9_-]/g, '_');
