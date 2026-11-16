export function hasFirebaseConfig(config) {
  return ['apiKey', 'authDomain', 'projectId', 'appId'].every(
    key => typeof config[key] === 'string' && config[key].trim().length > 0
  );
}
