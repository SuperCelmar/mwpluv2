// Artifact status type
export type ArtifactStatus = 'loading' | 'ready' | 'error';

// Base artifact interface
export interface BaseArtifact {
  id: string;
  status: ArtifactStatus;
  timestamp: Date;
  error?: string;
}

// Zone artifact data
export interface ZoneArtifactData {
  cityId: string;
  cityName: string;
  inseeCode: string;
  zoningId: string;
  zoningType: string;
  zoningName: string;
  zoneId?: string | null;
  zoneLibelle?: string;
  zoneName?: string;
  isConstructible?: boolean;
  isRnu?: boolean;
  address: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
}

// Map artifact data
export interface MapArtifactData {
  geometry?: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  } | {
    type: 'Polygon';
    coordinates: number[][][];
  };
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  center: {
    lat: number;
    lon: number;
  };
  zoneLibelle?: string;
  zoneName?: string;
  cityName: string;
  sourceUrl?: string;
  timestamp?: string;
}

// Document artifact data
export interface DocumentArtifactData {
  documentId: string;
  title: string;
  type: 'PLU' | 'POS' | 'RNU';
  summary?: string;
  htmlContent?: string;
  pdfUrl?: string;
  zoneLibelle?: string;
  cityName: string;
  inseeCode: string;
  sourceUrl?: string;
  sourceDate?: string;
  typologyId?: string;
  hasAnalysis?: boolean;
  analysisStatus?: 'pending' | 'processing' | 'complete' | 'error';
}

// Zone artifact
export interface ZoneArtifact extends BaseArtifact {
  type: 'zone';
  data?: ZoneArtifactData;
}

// Map artifact
export interface MapArtifact extends BaseArtifact {
  type: 'map';
  data?: MapArtifactData;
}

// Document artifact
export interface DocumentArtifact extends BaseArtifact {
  type: 'document';
  data?: DocumentArtifactData;
}

// Union type for all artifacts
export type Artifact = ZoneArtifact | MapArtifact | DocumentArtifact;

// Artifact collection
export interface ArtifactCollection {
  zone: ZoneArtifact;
  map: MapArtifact;
  document: DocumentArtifact;
}

