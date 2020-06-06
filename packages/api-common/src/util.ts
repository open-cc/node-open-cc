export function envProp(name: string | {(): string}, defaultValue?: string) {
  const val = typeof name === 'string' ? process.env[name] : name();
  return val ? val.replace(/\${([^}]+)}/g, (s, m) => eval(m)) : defaultValue;
}
