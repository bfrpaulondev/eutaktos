declare const Buffer: {
  from(input: string, encoding: 'base64'): { toString(encoding: 'utf8'): string };
  from(input: string): { toString(encoding: 'base64url'): string };
};
