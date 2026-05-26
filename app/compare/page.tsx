export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ComparePageClient from "./ComparePageClient";

export default function ComparePage() {
  return (
    <Suspense>
      <ComparePageClient />
    </Suspense>
  );
}
