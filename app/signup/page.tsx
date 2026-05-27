import { Suspense } from 'react';
import SignupPageClient from './SignupPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Create Account | Ultimate Baseball Tool',
};

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageClient />
    </Suspense>
  );
}
