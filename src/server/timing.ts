import { randomUUID } from "node:crypto";

export async function timeServerOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const label = `[CityPalaza] ${name} ${randomUUID()}`;
  console.time(label);
  try {
    return await operation();
  } finally {
    console.timeEnd(label);
  }
}
