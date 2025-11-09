'use client';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home, FolderOpen, FileText, Settings } from 'lucide-react';

export default function TestBreadcrumbPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold mb-8">Breadcrumb Component Examples</h1>
        </div>

        {/* Default Breadcrumb */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Default Breadcrumb</h2>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Current Page</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </section>

        {/* With Icons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">With Icons (Built-in Support)</h2>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" icon={Home}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects" icon={FolderOpen}>
                    Projects
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage icon={FileText}>Current Page</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </section>

        {/* Subtle Variant */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Subtle Variant (with background)</h2>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <Breadcrumb variant="subtle">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Current Page</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </section>

        {/* Mixed Icons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Mixed Icons (Some with, some without)</h2>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/" icon={Home}>
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage icon={Settings}>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </section>

        {/* Long Path */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Long Path Example</h2>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects/123">Project Details</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Very Long Current Page Name That Will Truncate</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </section>

        {/* Design Features */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Design Improvements</h2>
          <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Increased spacing between items for better readability</li>
              <li>Smooth hover effects with underline animation</li>
              <li>Enhanced focus states for keyboard accessibility</li>
              <li>Improved separator styling with muted colors</li>
              <li>Current page has medium font weight and truncation</li>
              <li>Optional subtle background variant</li>
              <li><strong>Built-in icon support</strong> - Pass any Lucide icon via the <code className="bg-gray-100 px-1 py-0.5 rounded">icon</code> prop</li>
              <li>Icons automatically sized (h-4 w-4) and properly spaced</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

