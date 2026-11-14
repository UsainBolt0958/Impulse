import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ActivityCalendar from '@/components/ActivityCalendar.jsx';

function CalendarPage() {
  return (
    <>
      <Helmet>
        <title>Calendar - Impulse</title>
        <meta name="description" content="Track your study activity and consistency" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h1 className="mb-2 text-3xl font-black uppercase tracking-tight sm:text-5xl">Study Calendar</h1>
              <p className="text-lg text-muted-foreground">Track your daily study activity</p>
            </div>

            <ActivityCalendar />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default CalendarPage;