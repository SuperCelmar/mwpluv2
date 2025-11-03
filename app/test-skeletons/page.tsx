import { ArtifactSkeleton } from "@/components/chat/ArtifactSkeleton";

export default function TestSkeletons() {
    return (
      <div className="p-8 space-y-8">
        <h1 className="text-2xl font-bold">Skeleton Loaders</h1>
        
        <section>
          <h2 className="text-lg mb-4">Analysis Skeleton</h2>
          <ArtifactSkeleton type="analysis" />
        </section>
        
        <section>
          <h2 className="text-lg mb-4">Map Skeleton</h2>
          <ArtifactSkeleton type="map" className="h-64" />
        </section>
        
        <section>
          <h2 className="text-lg mb-4">Document Skeleton</h2>
          <ArtifactSkeleton type="document" />
        </section>
      </div>
    )
  }