import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ColoredIcon from '@/components/ColoredIcon';
import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

function PreviousPapersPage() {
  return (
    <>
      <Helmet>
        <title>Previous Papers - Impulse</title>
        <meta name="description" content="Previous year papers collection" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h1 className="text-5xl font-black uppercase tracking-tight mb-2">Previous Papers</h1>
              <p className="text-lg text-muted-foreground">Browse and practice from past year question papers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { key: 'neet', label: 'NEET', desc: 'National Eligibility cum Entrance Test' },
                { key: 'jee-mains', label: 'JEE Main', desc: 'Joint Entrance Examination - Main' },
                { key: 'jee-advanced', label: 'JEE Advanced', desc: 'Joint Entrance Examination - Advanced' },
                { key: 'mht-cet', label: 'MHT CET', desc: 'Maharashtra Common Entrance Test' }
              ].map((exam) => (
                <Link key={exam.key} to={`/previous-papers/${exam.key}`} className="block group no-underline">
                  <Card className="h-full border-border transition-all duration-200 group-hover:border-primary group-hover:shadow-md group-hover:-translate-y-0.5">
                    <CardHeader>
                      <CardTitle className="text-lg font-black uppercase tracking-tight">{exam.label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-6">
                      <div className="flex items-start gap-3">
                        <ColoredIcon icon={BookOpen} name={exam.key} size={8} />
                        <p className="text-sm text-muted-foreground leading-relaxed">{exam.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default PreviousPapersPage;
