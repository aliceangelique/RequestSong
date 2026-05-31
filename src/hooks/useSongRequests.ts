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

interface UseSongRequestsProps {
  currentUser: {
    uid: string;
    displayName: string;
    email?: string;
    isSimulated?: boolean;
    isAnonymous?: boolean;
  } | null;
  effectiveEventId: string;
  initialSongs?: SongRequest[];
}

export function useSongRequests({ currentUser, effectiveEventId, initialSongs = [] }: UseSongRequestsProps) {
  const [requests, setRequests] = useState<SongRequest[]>(() => {
    const saved = localStorage.getItem(`rpd_offline_song_requests_${effectiveEventId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialSongs;
      }
    }
    return initialSongs;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [votedSongIds, setVotedSongIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize and load saved local votes when user changes
  useEffect(() => {
    if (currentUser) {
      const stored = localStorage.getItem(`rpd_votes_${currentUser.uid}`);
      if (stored) {
        try {
          setVotedSongIds(JSON.parse(stored));
        } catch {
          setVotedSongIds([]);
        }
      } else {
        setVotedSongIds([]);
      }
    } else {
      setVotedSongIds([]);
    }
  }, [currentUser]);

  // Synchronize local upvoted state with the actual voters list from Firestore
  useEffect(() => {
    if (!currentUser) return;
    const dbVotedIds = requests
      .filter((r) => r.voters && r.voters.some((v) => v.uid === currentUser.uid))
      .map((r) => r.id);
    
    if (dbVotedIds.length > 0) {
      setVotedSongIds((prev) => {
        const union = Array.from(new Set([...prev, ...dbVotedIds]));
        const isDifferent = union.length !== prev.length || union.some((v, i) => prev[i] !== v);
        if (isDifferent) {
          localStorage.setItem(`rpd_votes_${currentUser.uid}`, JSON.stringify(union));
          return union;
        }
        return prev;
      });
    }
  }, [requests, currentUser]);

  // Local helper to save requests offline safely
  const persistOfflineDataUpdated = useCallback((newList: SongRequest[]) => {
    setRequests(newList);
    localStorage.setItem(`rpd_offline_song_requests_${effectiveEventId}`, JSON.stringify(newList));
  }, [effectiveEventId]);

  // Append upvote locally to avoid multiple redundant database hits
  const recordVoteInLocalCache = useCallback((songId: string) => {
    if (!currentUser) return;
    setVotedSongIds((prev) => {
      if (prev.includes(songId)) return prev;
      const updated = [...prev, songId];
      localStorage.setItem(`rpd_votes_${currentUser.uid}`, JSON.stringify(updated));
      return updated;
    });
  }, [currentUser]);

  // Realtime subscription to Firebase
  useEffect(() => {
    if (!db || !isFirebaseConfigured) {
      setLoading(true);
      const saved = localStorage.getItem(`rpd_offline_song_requests_${effectiveEventId}`);
      if (saved) {
        try {
          setRequests(JSON.parse(saved));
        } catch {
          setRequests(initialSongs);
        }
      } else {
        setRequests(initialSongs);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestsRef = collection(db, 'songRequests');
    // Multi-device Querying & Streaming: Dynamically filter song requests matching current active event ID in real-time
    const q = query(requestsRef, where('eventId', '==', effectiveEventId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SongRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SongRequest);
        });

        // Merge offline/simulated user requests mock cache or load direct list
        const savedOffline = localStorage.getItem(`rpd_offline_song_requests_${effectiveEventId}`);
        let combined = [...list];
        if (savedOffline) {
          try {
            const parsedOffline = JSON.parse(savedOffline) as SongRequest[];
            const offlineUnsynced = parsedOffline.filter(
              (off) => !list.some((fb) => fb.id === off.id)
            );
            combined = [...list, ...offlineUnsynced];
          } catch {
            // Ignore corrupted local cache
          }
        }
        
        setRequests(combined);
        setConnectionError(false);
        setLoading(false);
      },
      (error) => {
        console.warn("Firestore access restricted, switching directly to local persistent sandbox storage.", error);
        setConnectionError(true);
        const saved = localStorage.getItem(`rpd_offline_song_requests_${effectiveEventId}`);
        if (saved) {
          try {
            setRequests(JSON.parse(saved));
          } catch {
            setRequests(initialSongs);
          }
        } else {
          setRequests(initialSongs);
        }
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, `songRequests?eventId=${effectiveEventId}`);
      }
    );

    return () => unsubscribe();
  }, [effectiveEventId, initialSongs]);

  // Case-insensitive duplicate check
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

  // Upvote logic
  const upvoteSong = useCallback(async (requestId: string) => {
    if (!currentUser) return;
    if (votedSongIds.includes(requestId)) return;

    recordVoteInLocalCache(requestId);

    if (isFirebaseConfigured && db && !connectionError) {
      try {
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

        await batch.commit();
      } catch (err) {
        console.warn("Firestore upvote failed, applying changes in local frame.", err);
        const updated = requests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                votesCount: r.votesCount + 1,
                updatedAt: { seconds: Math.floor(Date.now() / 1000) },
                voters: [...(r.voters || []), { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email || undefined }]
              }
            : r
        );
        persistOfflineDataUpdated(updated);
        handleFirestoreError(err, OperationType.WRITE, `songRequests/${requestId}`);
      }
    } else {
      const updated = requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              votesCount: r.votesCount + 1,
              updatedAt: { seconds: Math.floor(Date.now() / 1000) },
              voters: [...(r.voters || []), { uid: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email || undefined }]
            }
          : r
      );
      persistOfflineDataUpdated(updated);
    }
  }, [currentUser, votedSongIds, requests, recordVoteInLocalCache, connectionError, persistOfflineDataUpdated]);

  // Unvote/retract vote logic
  const unvoteSong = useCallback(async (requestId: string) => {
    if (!currentUser) return;
    if (!votedSongIds.includes(requestId)) return;

    const updatedVotes = votedSongIds.filter((id) => id !== requestId);
    setVotedSongIds(updatedVotes);
    localStorage.setItem(`rpd_votes_${currentUser.uid}`, JSON.stringify(updatedVotes));

    if (isFirebaseConfigured && db && !connectionError) {
      try {
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

        await batch.commit();
      } catch (err) {
        console.warn("Firestore unvote failed, processing changes local frame.", err);
        const updated = requests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                votesCount: Math.max(0, r.votesCount - 1),
                updatedAt: { seconds: Math.floor(Date.now() / 1000) },
                voters: (r.voters || []).filter((v) => v.uid !== currentUser.uid)
              }
            : r
        );
        persistOfflineDataUpdated(updated);
        handleFirestoreError(err, OperationType.WRITE, `songRequests/${requestId}`);
      }
    } else {
      const updated = requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              votesCount: Math.max(0, r.votesCount - 1),
              updatedAt: { seconds: Math.floor(Date.now() / 1000) },
              voters: (r.voters || []).filter((v) => v.uid !== currentUser.uid)
            }
          : r
      );
      persistOfflineDataUpdated(updated);
    }
  }, [currentUser, votedSongIds, requests, connectionError, persistOfflineDataUpdated]);

  // Submit Song Request Logic
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

    const trimmedTitle = title.trim();
    const trimmedArtist = artist.trim();
    const trimmedYoutube = youtubeUrl?.trim() || '';
    const trimmedTimestamp = timestamp?.trim() || '';

    if (!trimmedTitle || !trimmedArtist) {
      throw new Error('Both Song Title and Artist name are required!');
    }

    // Duplicate check
    const duplicate = checkDuplicateSong(trimmedTitle, trimmedArtist);
    if (duplicate) {
      await upvoteSong(duplicate.id);
      return { status: 'autovoted' };
    }

    setIsSubmitting(true);
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const freshRequest: SongRequest = {
      id: requestId,
      title: trimmedTitle,
      artist: trimmedArtist,
      creatorId: currentUser.uid,
      creatorName: currentUser.displayName,
      creatorEmail: currentUser.email || '',
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      updatedAt: { seconds: Math.floor(Date.now() / 1000) },
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

    if (isFirebaseConfigured && db && !connectionError) {
      try {
        const batch = writeBatch(db);
        const songRef = doc(db, 'songRequests', requestId);
        const voteRef = doc(db, 'songRequests', requestId, 'votes', currentUser.uid);

        batch.set(songRef, {
          ...freshRequest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        batch.set(voteRef, {
          voterId: currentUser.uid,
          voterName: currentUser.displayName,
          createdAt: serverTimestamp()
        });

        await batch.commit();
        recordVoteInLocalCache(requestId);
        setIsSubmitting(false);
        return { status: 'created' };
      } catch (err) {
        console.warn("Write blocked. Saving request to current offline session.", err);
        const nextList = [freshRequest, ...requests];
        persistOfflineDataUpdated(nextList);
        recordVoteInLocalCache(requestId);
        setIsSubmitting(false);
        return { status: 'created' };
      }
    } else {
      const nextList = [freshRequest, ...requests];
      persistOfflineDataUpdated(nextList);
      recordVoteInLocalCache(requestId);
      setIsSubmitting(false);
      return { status: 'created' };
    }
  }, [currentUser, effectiveEventId, checkDuplicateSong, upvoteSong, requests, persistOfflineDataUpdated, recordVoteInLocalCache, connectionError]);

  return {
    requests,
    loading,
    connectionError,
    votedSongIds,
    isSubmitting,
    upvoteSong,
    unvoteSong,
    submitSongRequest,
    persistOfflineDataUpdated,
    checkDuplicateSong
  };
}
