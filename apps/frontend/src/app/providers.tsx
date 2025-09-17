// apps/frontend/src/app/providers.tsx
'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ReactNode } from 'react';
import ThemeProviderClient from '@/components/ThemeProviderClient'; // [추가]

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProviderClient> 
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProviderClient>
  );
}