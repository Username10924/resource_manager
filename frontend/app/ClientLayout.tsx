'use client';

import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Toaster } from "react-hot-toast";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayout>{children}</AppLayout>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#18181b',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e4e4e7',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#18181b',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}
