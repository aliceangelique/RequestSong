export interface DanceEvent {
  id: string;
  name: string;
  place: string;
  time: string;
  createdAt: any;
  instagramUrl?: string;
}

export interface SongRequest {
  id: string;
  title: string;
  artist: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: any; // Firestore Timestamp or number (epoch)
  updatedAt: any; // Firestore Timestamp or number (epoch)
  status: 'pending' | 'approved' | 'rejected' | 'played';
  votesCount: number;
  dancePart?: 'Hook 1' | 'Hook 2' | 'Breakdance' | 'none';
  youtubeUrl?: string;
  timestamp?: string;
  eventId?: string; // Links song requests to a specific event
}

export interface Vote {
  voterId: string;
  voterName: string;
  createdAt: any; // Firestore Timestamp or number (epoch)
}
