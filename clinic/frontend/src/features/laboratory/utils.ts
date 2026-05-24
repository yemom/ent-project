export function serializeLabFindings(tests: string[], findings: Record<string, string>) {
  const lines = tests
    .map((test) => {
      const value = findings[test]?.trim();
      return value ? `${test}: ${value}` : '';
    })
    .filter(Boolean);

  if (lines.length > 0) {
    return lines.join('\n');
  }

  return Object.values(findings)
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');
}