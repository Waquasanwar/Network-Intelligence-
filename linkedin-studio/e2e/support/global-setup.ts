import { resetAndSeed } from "./fixtures";

export default async function globalSetup() {
  await resetAndSeed();
}
