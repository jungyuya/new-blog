// apps/frontend/src/components/ThemeProviderClient.tsx
'use client';

import { ThemeProvider } from 'next-themes';
import React from 'react';

export default function ThemeProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider 
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      {children}
    </ThemeProvider>
  );
}