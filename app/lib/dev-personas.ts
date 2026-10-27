export type DevPersona = {
  key: string;
  name: string;
  email: string;
  label: string;
  description: string;
};

export const DEV_PERSONAS: DevPersona[] = [
  {
    key: "student-a",
    name: "Student A",
    email: "student.a@example.test",
    label: "Student A",
    description: "Verified college student identity (Persona A)",
  },
  {
    key: "student-b",
    name: "Student B",
    email: "student.b@example.test",
    label: "Student B",
    description: "Verified college student identity (Persona B)",
  },
];

export function findPersona(key: string | undefined | null): DevPersona | undefined {
  if (!key) return undefined;
  return DEV_PERSONAS.find((p) => p.key === key);
}
