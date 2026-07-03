import { BookOpen, Download } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function AnnualBook() {
  const pdfUrl = '/annual-book.pdf';

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl pb-20 px-4 sm:px-6 lg:px-8 pb-16 space-y-8 page-motion-b h-[90vh] flex flex-col">
      <header className="section-motion section-motion-delay-1 shrink-0">
        <PageHeader
          eyebrow="Publications"
          title="CICR Annual Book"
          subtitle="Explore our journey, innovation, and achievements in robotics through the 2025-26 edition."
          icon={BookOpen}
          actions={
            <a
              href={pdfUrl}
              download="CICR-Annual-Book-25-26.pdf"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-colors"
            >
              <Download size={16} />
              Download PDF
            </a>
          }
        />
      </header>

      <section className="section-motion section-motion-delay-2 flex-grow border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* We use object to render native PDF viewer gracefully. Iframe is an alternative. */}
        <object
          data={`${pdfUrl}#view=FitH&toolbar=1&navpanes=0`}
          type="application/pdf"
          className="w-full h-full min-h-[70vh] border-0"
        >
          {/* Fallback if browser doesn't support PDF embedding natively */}
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
            <BookOpen size={48} className="mb-4 text-slate-300" />
            <p className="mb-4">It appears your browser doesn't support embedded PDFs.</p>
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              Open PDF in new tab
            </a>
          </div>
        </object>
      </section>
    </div>
  );
}
