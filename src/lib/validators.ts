export const REPO_FULLNAME_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/;

export const NPM_PACKAGE_PATTERN =
  /^(?:@[A-Za-z0-9_.-]{1,64}\/)?[A-Za-z0-9_.-]{1,100}$/;

export function isValidRepoFullName(value: string): boolean {
  return REPO_FULLNAME_PATTERN.test(value);
}

export function isValidNpmPackage(value: string): boolean {
  return NPM_PACKAGE_PATTERN.test(value);
}
