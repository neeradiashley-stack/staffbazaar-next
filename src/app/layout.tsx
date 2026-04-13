import type { Metadata } from 'next';
import './globals.css';
import './styles.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { JobsProvider } from '@/contexts/JobsContext';
import { ApplicantsProvider } from '@/contexts/ApplicantsContext';
import { SavedStaffProvider } from '@/contexts/SavedStaffContext';
import { MessagesProvider } from '@/contexts/MessagesContext';
import { WorkersProvider } from '@/contexts/WorkersContext';

export const metadata: Metadata = {
  title: 'StaffBazaar — Hire Restaurant Staff in India',
  description: "India's trusted platform for hiring restaurant & hospitality staff.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <WorkersProvider>
            <JobsProvider>
              <ApplicantsProvider>
                <SavedStaffProvider>
                  <MessagesProvider>{children}</MessagesProvider>
                </SavedStaffProvider>
              </ApplicantsProvider>
            </JobsProvider>
          </WorkersProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
