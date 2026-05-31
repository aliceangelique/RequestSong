import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from '../firebase';
import { SongRequest } from '../types';

interface UseFirebaseSongsProps {
  currentUser: {
    uid: string;
    displayName: string;
    email?: string;
  } | null;
  effectiveEventId: string;
}

export function useFirebaseSongs({ currentUser, effectiveEventId }: UseFirebaseSongsProps) {
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Derived state to quickly check which songs current user has voted on, directly from Firestore data
  const votedSongIds = currentUser
    ? requests
        .filter((r) => r.voters && r.voters.some((v) => v.uid === currentUser.uid))
        .map((r) => r.id)
    : [];

  // 1. Realtime Online Streaming (0% local sandboxing / no localStorage fallbacks)
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setError('Firebase is not configured or initialized.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestsRef = collection(db, 'songRequests');
    const q = query(requestsRef, where('eventId', '==', effectiveEventId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SongRequest[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || '',
            artist: data.artist || '',
            creatorId: data.creatorId || '',
            creatorName: data.creatorName || '',
            creatorEmail: data.creatorEmail || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            status: data.status || 'pending',
            votesCount: data.votesCount || 0,
            dancePart: data.dancePart || undefined,
            youtubeUrl: data.youtubeUrl || undefined,
            timestamp: data.timestamp || undefined,
            eventId: data.eventId || '',
            voters: data.voters || []
          } as SongRequest);
        });

        setRequests(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Realtime sync subscription failed:', err);
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, `songRequests?eventId=${effectiveEventId}`);
      }
    );

    return () => unsubscribe();
  }, [effectiveEventId]);

  // Duplicate check based entirely on real-time loaded requests
  const checkDuplicateSong = useCallback((title: string, artist: string) => {
    const cleanTitle = title.trim().toLowerCase();
    const cleanArtist = artist.trim().toLowerCase();

    return requests.find(
      (r) =>
        r.eventId === effectiveEventId &&
        r.title.toLowerCase() === cleanTitle &&
        r.artist.toLowerCase() === cleanArtist &&
        r.status !== 'rejected'
    );
  }, [requests, effectiveEventId]);

  // 2. 100% Online Voting (Direct batch operations to Firestore / 0% local manual state manipulation)
  const upvoteSong = useCallback(async (requestId: string) => {
    if (!currentUser) throw new Error('Please login to vote.');
    if (!db) throw new Error('Database connection is not available.');

    const batch = writeBatch(db);
    const songRef = doc(db, 'songRequests', requestId);
    const voteRef = doc(db, 'songRequests', requestId, 'votes', currentUser.uid);

    batch.set(voteRef, {
      voterId: currentUser.uid,
      voterName: currentUser.displayName,
      createdAt: serverTimestamp()
    });

    batch.update(songRef, {
      votesCount: increment(1),
      updatedAt: serverTimestamp(),
      voters: arrayUnion({
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        email: currentUser.email || ''
      })
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `songRequests/${requestId}/vote`);
    }
  }, [currentUser]);

  // Retract voting
  const unvoteSong = useCallback(async (requestId: string) => {
    if (!currentUser) throw new Error('Please login to retract your vote.');
    if (!db) throw new Error('Database connection is not available.');

    const batch = writeBatch(db);
    const songRef = doc(db, 'songRequests', requestId);
    const voteRef = doc(db, 'songRequests', requestId, 'votes', currentUser.uid);

    batch.delete(voteRef);

    batch.update(songRef, {
      votesCount: increment(-1),
      updatedAt: serverTimestamp(),
      voters: arrayRemove({
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        email: currentUser.email || ''
      })
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `songRequests/${requestId}/unvote`);
    }
  }, [currentUser]);

  // 3. 100% Online Request Submission (Saves immediately to Firebase with eventId / 0% offline queue)
  const submitSongRequest = useCallback(async (
    title: string,
    artist: string,
    dancePart?: 'Hook 1' | 'Hook 2' | 'Breakdance' | 'none',
    youtubeUrl?: string,
    timestamp?: string
  ): Promise<{ status: 'created' | 'autovoted' }> => {
    if (!currentUser) {
      throw new Error('Please authenticate first to request tracks!');
    }
    if (!db) {
      throw new Error('Database connection is not available.');
    }

    const trimmedTitle = title.trim();
    const trimmedArtist = artist.trim();
    const trimmedYoutube = youtubeUrl?.trim() || '';
    const trimmedTimestamp = timestamp?.trim() || '';

    if (!trimmedTitle || !trimmedArtist) {
      throw new Error('Both Song Title and Artist name are required!');
    }

    // Auto-upvote if it exists as duplicate
    const duplicate = checkDuplicateSong(trimmedTitle, trimmedArtist);
    if (duplicate) {
      await upvoteSong(duplicate.id);
      return { status: 'autovoted' };
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const batch = writeBatch(db);
    const songRef = doc(db, 'songRequests', requestId);
    const voteRef = doc(db, 'songRequests', requestId, 'votes', currentUser.uid);

    const freshRequest = {
      id: requestId,
      title: trimmedTitle,
      artist: trimmedArtist,
      creatorId: currentUser.uid,
      creatorName: currentUser.displayName,
      creatorEmail: currentUser.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'pending',
      votesCount: 1,
      dancePart: dancePart !== 'none' ? dancePart : undefined,
      youtubeUrl: trimmedYoutube || undefined,
      timestamp: trimmedTimestamp || undefined,
      eventId: effectiveEventId,
      voters: [{
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        email: currentUser.email || ''
      }]
    };

    batch.set(songRef, freshRequest);
    batch.set(voteRef, {
      voterId: currentUser.uid,
      voterName: currentUser.displayName,
      createdAt: serverTimestamp()
    });

    try {
      await batch.commit();
      return { status: 'created' };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `songRequests/${requestId}`);
    }
  }, [currentUser, effectiveEventId, checkDuplicateSong, upvoteSong]);

  return {
    requests,
    loading,
    error,
    votedSongIds,
    upvoteSong,
    unvoteSong,
    submitSongRequest,
    checkDuplicateSong
  };
}
