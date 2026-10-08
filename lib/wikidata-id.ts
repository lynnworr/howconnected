const QID_PATTERN = /^Q[1-9]\d*$/;

export function isValidQid(value: string): boolean {
  return QID_PATTERN.test(value);
}
