// frontend/src/components/Layout.tsx
import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { IdeasWidget } from './IdeasWidget';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
      <IdeasWidget />
    </div>
  );
}
