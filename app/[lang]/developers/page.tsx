import { Suspense } from "react";
import DeveloperConsole from "./DeveloperConsole";
export default function DevelopersPage() {
  return (
    <Suspense fallback={null}>
      <DeveloperConsole />
    </Suspense>
  );
}
