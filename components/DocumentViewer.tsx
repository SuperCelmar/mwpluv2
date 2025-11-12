'use client';

import { useEffect, useRef } from 'react';

interface DocumentViewerProps {
  htmlContent: string | null;
  className?: string;
  onRenderComplete?: () => void;
}

export function DocumentViewer({ htmlContent, className, onRenderComplete }: DocumentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const renderCompleteCalled = useRef(false);

  // Call onRenderComplete immediately when HTML content is available
  useEffect(() => {
    if (htmlContent && !renderCompleteCalled.current && onRenderComplete) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        if (!renderCompleteCalled.current) {
          renderCompleteCalled.current = true;
          onRenderComplete();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [htmlContent, onRenderComplete]);

  // Sanitize and enhance HTML content
  const sanitizedHtml = htmlContent ? sanitizeAndEnhanceHtml(htmlContent) : '';

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white ${className || ''}`}>
      {/* Simple header */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Document PLU</h3>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {sanitizedHtml ? (
          <div
            ref={contentRef}
            className="document-viewer-content pl-4 md:pl-8 pr-4 md:pr-8 text-gray-900 prose prose-sm max-w-none space-y-4 py-4"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              Aucun document disponible
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sanitize and enhance HTML content with proper styling
 * Adds classes for better typography and maintains document structure
 */
function sanitizeAndEnhanceHtml(html: string): string {
  // Create a temporary container to parse the HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Enhanced styling for different elements
  const styleMap: Record<string, string> = {
    h1: 'text-3xl font-bold mb-6 mt-8 text-gray-900 border-b pb-3',
    h2: 'text-2xl font-bold mb-4 mt-6 text-gray-900',
    h3: 'text-xl font-semibold mb-3 mt-5 text-gray-800',
    h4: 'text-lg font-semibold mb-2 mt-4 text-gray-800',
    h5: 'text-base font-semibold mb-2 mt-3 text-gray-700',
    h6: 'text-base font-medium mb-2 mt-3 text-gray-700',
    p: 'text-base leading-relaxed mb-4 text-gray-700',
    ul: 'list-disc list-inside mb-4 pl-4 space-y-2',
    ol: 'list-decimal list-inside mb-4 pl-4 space-y-2',
    li: 'text-base text-gray-700 mb-1',
    strong: 'font-semibold text-gray-900',
    em: 'italic text-gray-700',
    a: 'text-blue-600 hover:underline cursor-pointer',
    blockquote: 'border-l-4 border-blue-400 pl-4 italic text-gray-600 mb-4 py-2',
    code: 'bg-gray-100 px-2 py-1 rounded text-sm font-mono text-red-600 border border-gray-200',
    pre: 'bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto mb-4',
    table: 'w-full border-collapse border border-gray-300 my-4',
    thead: 'bg-gray-100 font-semibold',
    th: 'border border-gray-300 px-4 py-2 text-left font-semibold',
    td: 'border border-gray-300 px-4 py-2',
    hr: 'my-6 border-t-2 border-gray-300',
  };

  // Apply classes to all elements
  Object.entries(styleMap).forEach(([tag, classes]) => {
    const elements = temp.querySelectorAll(tag);
    elements.forEach((el) => {
      const existingClasses = el.getAttribute('class') || '';
      el.setAttribute('class', `${existingClasses} ${classes}`.trim());
    });
  });

  // Add visual separation and styling to sections
  const sections = temp.querySelectorAll('section, article, div[class*="section"]');
  sections.forEach((section) => {
    section.setAttribute('class', `${section.getAttribute('class') || ''} mb-8 pb-4 border-b border-gray-200 last:border-b-0`.trim());
  });

  // Improve contrast for small text
  const smallElements = temp.querySelectorAll('small, .text-sm, .text-xs');
  smallElements.forEach((el) => {
    el.setAttribute('class', `${el.getAttribute('class') || ''} text-gray-700`.trim());
  });

  return temp.innerHTML;
}


