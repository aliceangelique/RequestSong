import { useState, useEffect, useMemo, FormEvent, Fragment } from 'react';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  writeBatch,
  increment,
  serverTimestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Music,
  Search,
  Plus,
  ThumbsUp,
  Trash2,
  Check,
  LogOut,
  LogIn,
  Sparkles,
  AlertCircle,
  Heart,
  User as UserIcon,
  Crown,
  PartyPopper,
  Link,
  Clock,
  CheckCircle,
  XCircle,
  X,
  TrendingUp,
  ExternalLink,
  Calendar,
  MapPin,
  Instagram,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  db,
  auth,
  isFirebaseConfigured,
  signInWithGoogle,
  handleSignOut
} from './firebase';
import { SongRequest, DanceEvent } from './types';

// Pre-seeded starter events to support historical and new play spaces
const INITIAL_OFFLINE_EVENTS: DanceEvent[] = [
  {
    id: 'event_1',
    name: 'Bangkok Random Play Dance Pride Fest 2026',
    place: 'Siam Square Block I Walking Street, Bangkok',
    time: 'May 30, 2026, 4:00 PM',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 50000 },
    instagramUrl: 'https://www.instagram.com/p/DYSCCDMChxv/'
  },
  {
    id: 'event_2',
    name: 'Silom Gay Pride K-Pop Dance Arena',
    place: 'Silom Road Pedestrian Walkway, Bangkok',
    time: 'June 15, 2026, 6:00 PM',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 40000 }
  }
];

// Pre-seeded starter requests linked to event_1
const INITIAL_OFFLINE_SONGS: SongRequest[] = [
  {
    id: 'req_1_supershy',
    title: 'Super Shy',
    artist: 'NewJeans',
    creatorId: 'user_lisa',
    creatorName: 'Lisa Park',
    creatorEmail: 'lisa.dance@gmail.com',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 10000 },
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 10000 },
    status: 'approved',
    votesCount: 32,
    dancePart: 'Hook 1',
    youtubeUrl: 'https://www.youtube.com/watch?v=ArmDp-zijyM',
    timestamp: '0:22',
    eventId: 'event_1'
  },
  {
    id: 'req_2_dynamite',
    title: 'Dynamite',
    artist: 'BTS',
    creatorId: 'user_minho',
    creatorName: 'Minho Kim',
    creatorEmail: 'minho.kpop@gmail.com',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 8000 },
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 8000 },
    status: 'approved',
    votesCount: 28,
    dancePart: 'Hook 2',
    youtubeUrl: 'https://www.youtube.com/watch?v=gdZLi9oWNZg',
    timestamp: '1:05',
    eventId: 'event_1'
  },
  {
    id: 'req_3_lovedive',
    title: 'Love Dive',
    artist: 'IVE',
    creatorId: 'user_kai',
    creatorName: 'Kai Tanaka',
    creatorEmail: 'kai@kpopdev.com',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 5000 },
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 5000 },
    status: 'pending',
    votesCount: 19,
    dancePart: 'Breakdance',
    eventId: 'event_1'
  },
  {
    id: 'req_4_magnetic',
    title: 'Magnetic',
    artist: 'ILLIT',
    creatorId: 'user_alex',
    creatorName: 'Alex Thorne',
    creatorEmail: 'alex.pride@lgbtq.org',
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 2000 },
    updatedAt: { seconds: Math.floor(Date.now() / 1000) - 2000 },
    status: 'pending',
    votesCount: 14,
    dancePart: 'Hook 1',
    eventId: 'event_1'
  }
];

const getInstagramShortcode = (url?: string) => {
  if (!url) return null;
  try {
    const cleanUrl = url.trim();
    const match = cleanUrl.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (err) {
    console.error("Error parsing Instagram URL", err);
  }
  return null;
};

const formatEventTime = (timeStr: string): string => {
  if (!timeStr) return '';
  if (timeStr.includes('|')) {
    const parts = timeStr.split('|');
    if (parts.length >= 2) {
      const dateStr = parts[0]; // "2026-05-30"
      const startTimeStr = parts[1]; // "16:00"
      const endTimeStr = parts[2]; // "18:30" (optional)
      
      try {
        const dateObj = new Date(dateStr + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        
        const formatTime = (t: string) => {
          if (!t) return '';
          const [h, m] = t.split(':');
          if (!h || !m) return t;
          const hr = parseInt(h, 10);
          const ampm = hr >= 12 ? 'PM' : 'AM';
          const displayHr = hr % 12 || 12;
          return `${displayHr}:${m} ${ampm}`;
        };
        
        const startFormatted = formatTime(startTimeStr);
        const endFormatted = endTimeStr ? ` - ${formatTime(endTimeStr)}` : '';
        
        return `${formattedDate}, ${startFormatted}${endFormatted}`;
      } catch (err) {
        // Fallback
      }
    }
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timeStr)) {
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (e) {
      // Fallback
    }
  }
  return timeStr;
};

export default function App() {
  // Authentication states
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [offlineUser, setOfflineUser] = useState<{
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  // Firestore connection status checker
  const [connectionError, setConnectionError] = useState<boolean>(false);

  // Requests state container
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Event State details
  const [events, setEvents] = useState<DanceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('event_1');
  const [activeEventId, setActiveEventId] = useState<string>('event_1');
  
  // Event inputs
  const [newEventName, setNewEventName] = useState('');
  const [newEventPlace, setNewEventPlace] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newEventInstagramUrl, setNewEventInstagramUrl] = useState('');
  const [eventSuccess, setEventSuccess] = useState(false);

  // Active View Mode ('user' for Dance Fans, 'organizer' for DJ Organizer / Admin)
  const [userRole, setUserRole] = useState<'user' | 'organizer'>('user');

  // Input states for song request form
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [dancePart, setDancePart] = useState<'Hook 1' | 'Hook 2' | 'Breakdance' | 'none'>('none');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [timestamp, setTimestamp] = useState('');

  // Form states and alerts
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotification, setSuccessNotification] = useState<'created' | 'autovoted' | null>(null);

  // Filter query state
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile active tab for dancer view ('request' | 'playlist' | 'poster')
  const [mobileDancerTab, setMobileDancerTab] = useState<'request' | 'playlist' | 'poster'>('playlist');

  // Organizer view mode: 'ranked' (default) or 'grouped' (grouped by requester)
  const [organizerViewMode, setOrganizerViewMode] = useState<'ranked' | 'grouped'>('ranked');

  // Upvoted IDs cache (device specific to prevent infinite ballot box stuffing)
  const [votedSongIds, setVotedSongIds] = useState<string[]>([]);

  // Computed current user derived from either live Firebase context or offline simulation mode
  const currentUser = useMemo(() => {
    if (isFirebaseConfigured && firebaseUser) {
      return {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Anonymous Dancer',
        email: firebaseUser.email || 'dancer@randomdance.net',
        photoURL: firebaseUser.photoURL || undefined
      };
    }
    return offlineUser;
  }, [firebaseUser, offlineUser]);

  // Admin identity check (specifically Digimon.Angelique@gmail.com specified by user context)
  const isAdmin = useMemo(() => {
    return currentUser?.email === 'Digimon.Angelique@gmail.com';
  }, [currentUser]);

  // Secure admin guardrail: revert non-admin users straight to the user dancer workspace
  useEffect(() => {
    if (userRole === 'organizer' && !isAdmin) {
      setUserRole('user');
    }
  }, [isAdmin, userRole]);

  // Load voter safe codes
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

  // Append upvote locally to avoid multiple redundant database hits
  const recordVoteInLocalCache = (songId: string) => {
    if (!currentUser) return;
    const updated = [...votedSongIds, songId];
    setVotedSongIds(updated);
    localStorage.setItem(`rpd_votes_${currentUser.uid}`, JSON.stringify(updated));
  };

  // Setup simulation default user immediately for seamless offline workspace interaction
  useEffect(() => {
    if (!db || !isFirebaseConfigured || !auth) {
      const savedUser = localStorage.getItem('rpd_simulated_user');
      if (savedUser) {
        try {
          setOfflineUser(JSON.parse(savedUser));
        } catch {
          setOfflineUser(null);
        }
      } else {
        const defaultUser = {
          uid: 'user_dancer',
          displayName: 'Sunny Dancer',
          email: 'dancer@prideflow.org'
        };
        setOfflineUser(defaultUser);
        localStorage.setItem('rpd_simulated_user', JSON.stringify(defaultUser));
      }
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setFirebaseUser(usr);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen for globally designated Active Event setting
  useEffect(() => {
    if (!db || !isFirebaseConfigured) {
      const saved = localStorage.getItem('rpd_active_event_id');
      if (saved) {
        setActiveEventId(saved);
      } else {
        setActiveEventId('event_1');
      }
      return;
    }

    const docConfigRef = doc(db, 'settings', 'activeEvent');
    const unsubscribe = onSnapshot(
      docConfigRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.activeEventId) {
            setActiveEventId(data.activeEventId);
          }
        } else {
          setActiveEventId('event_1');
        }
      },
      (error) => {
        console.warn("Firestore activeEvent settings query restricted. Using local.", error);
        const saved = localStorage.getItem('rpd_active_event_id');
        if (saved) {
          setActiveEventId(saved);
        } else {
          setActiveEventId('event_1');
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen for Firestore Events updates with robust localStorage fallback
  useEffect(() => {
    if (!db || !isFirebaseConfigured) {
      const saved = localStorage.getItem('rpd_offline_dance_events');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            setEvents(parsed);
            setSelectedEventId(parsed[0].id);
          } else {
            setEvents(INITIAL_OFFLINE_EVENTS);
            setSelectedEventId('event_1');
            localStorage.setItem('rpd_offline_dance_events', JSON.stringify(INITIAL_OFFLINE_EVENTS));
          }
        } catch {
          setEvents(INITIAL_OFFLINE_EVENTS);
          setSelectedEventId('event_1');
          localStorage.setItem('rpd_offline_dance_events', JSON.stringify(INITIAL_OFFLINE_EVENTS));
        }
      } else {
        setEvents(INITIAL_OFFLINE_EVENTS);
        setSelectedEventId('event_1');
        localStorage.setItem('rpd_offline_dance_events', JSON.stringify(INITIAL_OFFLINE_EVENTS));
      }
      return;
    }

    const eventsRef = collection(db, 'danceEvents');
    const unsubscribe = onSnapshot(
      eventsRef,
      (snapshot) => {
        const list: DanceEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name || '',
            place: data.place || '',
            time: data.time || '',
            createdAt: data.createdAt,
            instagramUrl: data.instagramUrl || ''
          });
        });
        if (list.length > 0) {
          const sortedList = list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setEvents(sortedList);
          // Set active event if not set or invalid
          setSelectedEventId((prev) => {
            if (prev && sortedList.some((ev) => ev.id === prev)) return prev;
            return sortedList[0].id;
          });
        } else {
          setEvents(INITIAL_OFFLINE_EVENTS);
          setSelectedEventId('event_1');
        }
      },
      (error) => {
        console.warn("Firestore events query restricted, using local state instead.");
        const saved = localStorage.getItem('rpd_offline_dance_events');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setEvents(parsed);
            if (parsed.length > 0) setSelectedEventId(parsed[0].id);
          } catch {
            setEvents(INITIAL_OFFLINE_EVENTS);
            setSelectedEventId('event_1');
          }
        } else {
          setEvents(INITIAL_OFFLINE_EVENTS);
          setSelectedEventId('event_1');
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen for Firestore real-time updates with robust localStorage fallback
  useEffect(() => {
    if (!db || !isFirebaseConfigured) {
      setLoading(true);
      const saved = localStorage.getItem('rpd_offline_song_requests');
      if (saved) {
        try {
          setRequests(JSON.parse(saved));
        } catch {
          setRequests(INITIAL_OFFLINE_SONGS);
          localStorage.setItem('rpd_offline_song_requests', JSON.stringify(INITIAL_OFFLINE_SONGS));
        }
      } else {
        setRequests(INITIAL_OFFLINE_SONGS);
        localStorage.setItem('rpd_offline_song_requests', JSON.stringify(INITIAL_OFFLINE_SONGS));
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    const requestsRef = collection(db, 'songRequests');
    const unsubscribe = onSnapshot(
      requestsRef,
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
            dancePart: data.dancePart || 'none',
            youtubeUrl: data.youtubeUrl || '',
            timestamp: data.timestamp || '',
            eventId: data.eventId || 'event_1'
          });
        });
        setRequests(list);
        setLoading(false);
      },
      (error) => {
        console.warn("Firestore access restricted, switching directly to local persistent sandbox storage.");
        setConnectionError(true);
        const saved = localStorage.getItem('rpd_offline_song_requests');
        if (saved) {
          setRequests(JSON.parse(saved));
        } else {
          setRequests(INITIAL_OFFLINE_SONGS);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save requests offline safely
  const persistOfflineDataUpdated = (newList: SongRequest[]) => {
    setRequests(newList);
    localStorage.setItem('rpd_offline_song_requests', JSON.stringify(newList));
  };

  // Auth Handlers
  const triggerGoogleSignInFlow = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await signInWithGoogle();
      } catch (err) {
        console.warn("Popup blocked, utilizing simple account switcher simulation.", err);
        setShowRoleSelector(true);
      }
    } else {
      setShowRoleSelector(true);
    }
  };

  const handleSimulatedProfileSwitch = (profile: { uid: string; displayName: string; email: string }) => {
    setOfflineUser(profile);
    localStorage.setItem('rpd_simulated_user', JSON.stringify(profile));
    setShowRoleSelector(false);
  };

  const triggerSignOutFlow = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await handleSignOut();
      } catch (err) {
        console.error("Signout failed:", err);
      }
    }
    setOfflineUser(null);
    localStorage.removeItem('rpd_simulated_user');
  };

  // Upvote Action Core
  const handleSongUpvoteAction = async (requestId: string) => {
    if (!currentUser) {
      alert("Please authenticate or switch profile first to vote!");
      return;
    }

    if (votedSongIds.includes(requestId)) {
      return; // Pre-cache safety lock
    }

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
          updatedAt: serverTimestamp()
        });

        await batch.commit();
      } catch (err) {
        console.warn("Firestore upvote failed, applying changes in local frame.", err);
        const updated = requests.map((r) =>
          r.id === requestId ? { ...r, votesCount: r.votesCount + 1, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : r
        );
        persistOfflineDataUpdated(updated);
      }
    } else {
      const updated = requests.map((r) =>
        r.id === requestId ? { ...r, votesCount: r.votesCount + 1, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : r
      );
      persistOfflineDataUpdated(updated);
    }
  };

  // Unvote Action Core
  const handleSongUnvoteAction = async (requestId: string) => {
    if (!currentUser) {
      alert("Please authenticate or switch profile first to unvote!");
      return;
    }

    if (!votedSongIds.includes(requestId)) {
      return; // Not voted, nothing to retract
    }

    // Retract local cache vote instantly for immediate user feedback
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
          updatedAt: serverTimestamp()
        });

        await batch.commit();
      } catch (err) {
        console.warn("Firestore unvote failed, processing changes local frame.", err);
        const updated = requests.map((r) =>
          r.id === requestId ? { ...r, votesCount: Math.max(0, r.votesCount - 1), updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : r
        );
        persistOfflineDataUpdated(updated);
      }
    } else {
      const updated = requests.map((r) =>
        r.id === requestId ? { ...r, votesCount: Math.max(0, r.votesCount - 1), updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : r
      );
      persistOfflineDataUpdated(updated);
    }
  };

  // Case-insensitive duplicate check to convert repeats to votes organically
  const checkDuplicateSong = (title: string, artist: string) => {
    const cleanTitle = title.trim().toLowerCase();
    const cleanArtist = artist.trim().toLowerCase();

    return requests.find(
      (r) =>
        r.title.toLowerCase() === cleanTitle &&
        r.artist.toLowerCase() === cleanArtist &&
        r.status !== 'rejected'
    );
  };

  // Submit Song Request Handler
  const handleRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessNotification(null);

    if (!currentUser) {
      setFormError('Please authenticate first to request tracks!');
      return;
    }

    const trimmedTitle = newTitle.trim();
    const trimmedArtist = newArtist.trim();
    const trimmedYoutube = youtubeUrl.trim();
    const trimmedTimestamp = timestamp.trim();

    if (!trimmedTitle || !trimmedArtist) {
      setFormError('Both Song Title and Artist/Group name are required!');
      return;
    }

    // CONVERSION TO VOTE - check if duplicate already exists!
    const duplicate = checkDuplicateSong(trimmedTitle, trimmedArtist);
    if (duplicate) {
      // Automatically triggers upvote on duplicate
      await handleSongUpvoteAction(duplicate.id);

      // Clean inputs
      setNewTitle('');
      setNewArtist('');
      setDancePart('none');
      setYoutubeUrl('');
      setTimestamp('');

      setSuccessNotification('autovoted');
      setTimeout(() => setSuccessNotification(null), 5000);
      return;
    }

    setIsSubmitting(true);

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const freshRequest: SongRequest = {
      id: requestId,
      title: trimmedTitle,
      artist: trimmedArtist,
      creatorId: currentUser.uid,
      creatorName: currentUser.displayName,
      creatorEmail: currentUser.email,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      updatedAt: { seconds: Math.floor(Date.now() / 1000) },
      status: 'pending',
      votesCount: 1,
      dancePart: dancePart !== 'none' ? dancePart : undefined,
      youtubeUrl: trimmedYoutube || undefined,
      timestamp: trimmedTimestamp || undefined,
      eventId: effectiveEventId
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

        // Reset
        setNewTitle('');
        setNewArtist('');
        setDancePart('none');
        setYoutubeUrl('');
        setTimestamp('');

        setSuccessNotification('created');
        setTimeout(() => setSuccessNotification(null), 5000);
      } catch (err) {
        console.warn("Write blocked. Saving request to current offline session.", err);
        const nextList = [freshRequest, ...requests];
        persistOfflineDataUpdated(nextList);
        recordVoteInLocalCache(requestId);

        // Reset
        setNewTitle('');
        setNewArtist('');
        setDancePart('none');
        setYoutubeUrl('');
        setTimestamp('');

        setSuccessNotification('created');
        setTimeout(() => setSuccessNotification(null), 5000);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setTimeout(() => {
        const nextList = [freshRequest, ...requests];
        persistOfflineDataUpdated(nextList);
        recordVoteInLocalCache(requestId);

        // Reset
        setNewTitle('');
        setNewArtist('');
        setDancePart('none');
        setYoutubeUrl('');
        setTimestamp('');

        setSuccessNotification('created');
        setIsSubmitting(false);
        setTimeout(() => setSuccessNotification(null), 5000);
      }, 300);
    }
  };

  // Moderator Control Handlers
  const handleAdminStatusUpdate = async (requestId: string, newStatus: 'pending' | 'approved' | 'rejected' | 'played') => {
    // Immediate optimistic local update so the UI updates instantly across all views
    const updated = requests.map((r) =>
      r.id === requestId ? { ...r, status: newStatus, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } : r
    );
    persistOfflineDataUpdated(updated);

    if (isFirebaseConfigured && db && !connectionError) {
      try {
        const songRef = doc(db, 'songRequests', requestId);
        await updateDoc(songRef, {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Failed syncing online moderator state. Already updated locally.", err);
      }
    }
  };

  const handleAdminDeleteSource = async (requestId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this request?")) {
      return;
    }

    // Immediate optimistic local delete so the UI updates instantly online/offline for both views
    const filtered = requests.filter((r) => r.id !== requestId);
    persistOfflineDataUpdated(filtered);

    if (isFirebaseConfigured && db && !connectionError) {
      try {
        const songRef = doc(db, 'songRequests', requestId);
        await deleteDoc(songRef);
      } catch (err) {
        console.warn("Online delete failed. Already applied locally.", err);
      }
    }
  };

  // Rehearsal Helper: Clear all song requests completely for both user and admin (Pristine 0-list)
  const handleWipeAllRequests = async () => {
    if (!window.confirm("🚨 WARNING: Are you sure you want to delete ALL song requests? This will instantly wipe the list on BOTH the Fan Hub and Organizer Board to start a blank-slate rehearsal with 0 tracks!")) {
      return;
    }

    const idsToDelete = requests.map((r) => r.id);

    // 1. Instantly write empty state locally
    persistOfflineDataUpdated([]);

    // 2. Erase from Firestore concurrently if connected
    if (isFirebaseConfigured && db && !connectionError) {
      try {
        await Promise.all(
          idsToDelete.map(async (id) => {
            await deleteDoc(doc(db, 'songRequests', id));
          })
        );
      } catch (err) {
        console.warn("Online wipe failed.", err);
      }
    }
  };

  // Rehearsal Helper: Reset to 4 default seed songs
  const handleResetToSeeds = async () => {
    if (!window.confirm("Do you want to reset the active catalog and restore the 4 default mockup seed songs for both users and organizers?")) {
      return;
    }

    const idsToDelete = requests.map((r) => r.id);

    // 1. Instantly write seed state locally
    persistOfflineDataUpdated(INITIAL_OFFLINE_SONGS);

    // 2. Clean and set online to Firestore if connected
    if (isFirebaseConfigured && db && !connectionError) {
      try {
        // Clear all old requests online first
        await Promise.all(
          idsToDelete.map(async (id) => {
            await deleteDoc(doc(db, 'songRequests', id));
          })
        );

        // Upload new seeds online
        await Promise.all(
          INITIAL_OFFLINE_SONGS.map(async (song) => {
            await setDoc(doc(db, 'songRequests', song.id), {
              ...song,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          })
        );
      } catch (err) {
        console.warn("Online seed restore failed.", err);
      }
    }
  };

  // Create New Event Action
  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventPlace.trim() || !newEventDate || !newEventStartTime) {
      alert("Please fill in the Event Name, Place, Date, and Start Time first!");
      return;
    }

    const combinedTime = `${newEventDate}|${newEventStartTime}` + (newEventEndTime ? `|${newEventEndTime}` : "");
    const eventId = `event_${Date.now()}`;
    const freshEvent: DanceEvent = {
      id: eventId,
      name: newEventName.trim(),
      place: newEventPlace.trim(),
      time: combinedTime,
      instagramUrl: newEventInstagramUrl.trim() || undefined,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    };

    if (isFirebaseConfigured && db && !connectionError) {
      try {
        const eventDocRef = doc(db, 'danceEvents', eventId);
        await setDoc(eventDocRef, {
          name: freshEvent.name,
          place: freshEvent.place,
          time: freshEvent.time,
          instagramUrl: freshEvent.instagramUrl || '',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Failed syncing new event to Firebase, saving offline.", err);
        const nextEvents = [freshEvent, ...events];
        setEvents(nextEvents);
        localStorage.setItem('rpd_offline_dance_events', JSON.stringify(nextEvents));
      }
    } else {
      const nextEvents = [freshEvent, ...events];
      setEvents(nextEvents);
      localStorage.setItem('rpd_offline_dance_events', JSON.stringify(nextEvents));
    }

    setSelectedEventId(eventId);
    setNewEventName('');
    setNewEventPlace('');
    setNewEventTime('');
    setNewEventDate('');
    setNewEventStartTime('');
    setNewEventEndTime('');
    setNewEventInstagramUrl('');
    setEventSuccess(true);
    setTimeout(() => setEventSuccess(false), 4500);
    
    // Auto-activate newly created event globally
    handleToggleActiveEvent(eventId);
  };

  // Synchronize active event globally (Admins only)
  const handleToggleActiveEvent = async (targetId: string) => {
    if (isFirebaseConfigured && db && !connectionError) {
      try {
        const docRef = doc(db, 'settings', 'activeEvent');
        await setDoc(docRef, {
          activeEventId: targetId,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Failed updating active event state in Firebase, defaulting local.", err);
        setActiveEventId(targetId);
        localStorage.setItem('rpd_active_event_id', targetId);
      }
    } else {
      setActiveEventId(targetId);
      localStorage.setItem('rpd_active_event_id', targetId);
    }
  };

  // Generate interactive random track stimulation helper
  const triggerRandomSimulatedRequest = () => {
    const SONGS = [
      { title: 'Supernova', artist: 'aespa', part: 'Hook 1' as const },
      { title: 'How Sweet', artist: 'NewJeans', part: 'Breakdance' as const },
      { title: 'Armageddon', artist: 'aespa', part: 'Hook 2' as const },
      { title: 'EASY', artist: 'LE SSERAFIM', part: 'Hook 1' as const },
      { title: 'OMG', artist: 'NewJeans', part: 'Hook 2' as const },
      { title: 'Savage', artist: 'aespa', part: 'Breakdance' as const },
      { title: 'Baddie', artist: 'IVE', part: 'Hook 1' as const },
      { title: 'Smart', artist: 'LE SSERAFIM', part: 'Hook 1' as const }
    ];

    const DANCERS = [
      { name: 'Kai Tanaka', email: 'kai@kpopdev.com' },
      { name: 'Sora Park', email: 'sora@high-energy.ko' },
      { name: 'Yuna Kim', email: 'yuna@prideflow.org' },
      { name: 'Leo Martinez', email: 'leo@martinez.org' }
    ];

    const pickSong = SONGS[Math.floor(Math.random() * SONGS.length)];
    const pickDancer = DANCERS[Math.floor(Math.random() * DANCERS.length)];

    const duplicate = checkDuplicateSong(pickSong.title, pickSong.artist);
    if (duplicate) {
      handleSongUpvoteAction(duplicate.id);
      return;
    }

    const simId = `sim_${Date.now()}`;
    const simRequest: SongRequest = {
      id: simId,
      title: pickSong.title,
      artist: pickSong.artist,
      creatorId: `user_sim_${Math.floor(Math.random() * 90000)}`,
      creatorName: pickDancer.name,
      creatorEmail: pickDancer.email,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      updatedAt: { seconds: Math.floor(Date.now() / 1000) },
      status: 'pending',
      votesCount: Math.floor(Math.random() * 6) + 1,
      dancePart: pickSong.part,
      eventId: effectiveEventId
    };

    const nextList = [simRequest, ...requests];
    persistOfflineDataUpdated(nextList);
  };

  // Find which event we should actually display/filter based on current viewer's role
  const effectiveEventId = useMemo(() => {
    if (userRole === 'user') {
      return activeEventId;
    }
    return selectedEventId;
  }, [userRole, activeEventId, selectedEventId]);

  // Filter requests by current effective event before calculating rankings
  const eventSubsetRequests = useMemo(() => {
    return requests.filter((r) => {
      const eId = r.eventId || 'event_1';
      return eId === effectiveEventId;
    });
  }, [requests, effectiveEventId]);

  // Find current active/focus event metadata or fall back to default
  const currentEvent = useMemo(() => {
    return events.find((e) => e.id === effectiveEventId) || events[0] || {
      id: 'event_1',
      name: 'Bangkok Random Play Dance Pride Fest 2026',
      place: 'Siam Square Block I Walking Street, Bangkok',
      time: 'May 30, 2026, 4:00 PM'
    };
  }, [events, effectiveEventId]);

  // Determine if the active event has already ended (is in the past)
  const isActiveEventPast = useMemo(() => {
    const targetEvent = events.find((e) => e.id === activeEventId) || events[0];
    if (!targetEvent) return false;
    const timeStr = targetEvent.time;
    if (!timeStr) return false;
    try {
      if (timeStr.includes('|')) {
        const parts = timeStr.split('|');
        const datePart = parts[0]; // YYYY-MM-DD
        const timePart = parts[2] || parts[1]; // End time or Start time
        if (datePart && timePart) {
          const dt = new Date(`${datePart}T${timePart}:00`);
          if (!isNaN(dt.getTime())) {
            return dt.getTime() < Date.now();
          }
        }
      }
      const parsed = new Date(timeStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime() < Date.now();
      }
    } catch (e) {
      console.error("isEventInPast parsing error", e);
    }
    return false;
  }, [events, activeEventId]);

  // Track sorting algorithm: most popular first
  const rankingSummaryRequests = useMemo(() => {
    return [...eventSubsetRequests].sort((a, b) => {
      if (b.votesCount !== a.votesCount) {
        return b.votesCount - a.votesCount;
      }
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [eventSubsetRequests]);

  // Compute live search queries on list
  const queryFilteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return rankingSummaryRequests;
    const term = searchQuery.toLowerCase();
    return rankingSummaryRequests.filter(
      (r) =>
        r.title.toLowerCase().includes(term) ||
        r.artist.toLowerCase().includes(term) ||
        r.creatorName.toLowerCase().includes(term)
    );
  }, [rankingSummaryRequests, searchQuery]);

  // Group requests by requester
  const groupedByRequesterRequests = useMemo(() => {
    const groups: {
      creatorName: string;
      creatorEmail: string;
      songs: SongRequest[];
    }[] = [];

    queryFilteredRequests.forEach((req) => {
      const emailLower = (req.creatorEmail || '').toLowerCase().trim();
      const nameTrimmed = (req.creatorName || '').trim();

      const existing = groups.find((g) => {
        if (emailLower && g.creatorEmail.toLowerCase().trim() === emailLower) {
          return true;
        }
        return g.creatorName.trim().toLowerCase() === nameTrimmed.toLowerCase();
      });

      if (existing) {
        existing.songs.push(req);
      } else {
        groups.push({
          creatorName: req.creatorName || 'Anonymous',
          creatorEmail: req.creatorEmail || 'No Email',
          songs: [req],
        });
      }
    });

    // Sort groups dynamically: first groups with more requests, then alphabetically by name
    return groups.sort((a, b) => b.songs.length - a.songs.length || a.creatorName.localeCompare(b.creatorName));
  }, [queryFilteredRequests]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-brand-yellow selection:text-slate-950" id="rpd-app-root">
      
      {/* LGBTQIA+ PRIDE DECORATED HEADBAND RIBBON */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#E40303] via-[#FF8C00] via-[#FFED00] via-[#008026] via-[#004CFF] to-[#732982] opacity-90" aria-hidden="true" id="pride-rainbow-header" />

      {/* QUICK STATUS BAR WITH IDENTITY SYSTEM */}
      <div className="bg-slate-900/90 border-b border-brand-yellow/20 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-3.5 w-5 rounded overflow-hidden flex-shrink-0 bg-gradient-to-r from-[#E40303] via-[#FF8C00] via-[#FFED00] via-[#008026] via-[#004CFF] to-[#732982]" title="LGBTQIA+ Community Support Pride Banner" />
          <span className="text-slate-350 font-bold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow animate-pulse" />
            Bangkok Random Dance
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="inline-flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setUserRole('user')}
                className={`px-2.5 py-1 rounded text-[10px] font-black tracking-tight transition cursor-pointer ${
                  userRole === 'user'
                    ? 'bg-brand-yellow text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🕺 Dancer View
              </button>
              <button
                onClick={() => setUserRole('organizer')}
                className={`px-2.5 py-1 rounded text-[10px] font-black tracking-tight transition cursor-pointer ${
                  userRole === 'organizer'
                    ? 'bg-brand-yellow text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                👑 Organizer View
              </button>
            </div>
          )}
        </div>
      </div>
           {/* MOBILE-ONLY USER IDENTITY BAR - positioned at the top before the header section */}
      <div className="md:hidden block bg-slate-950/60 border-b border-slate-900 px-4 py-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
          My Account / บัญชี
        </span>
        <div>
          {authLoading ? (
            <div className="h-8 w-20 bg-slate-900 rounded-lg animate-pulse" />
          ) : currentUser ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-full py-0.5 pl-1.5 pr-2 text-xs">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-5 h-5 rounded-full object-cover border border-brand-yellow"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-brand-yellow text-slate-950 flex items-center justify-center text-[10px] font-black">
                  {currentUser.displayName.charAt(0)}
                </div>
              )}
              <span className="font-bold text-slate-200 truncate max-w-[100px] text-[10px]">{currentUser.displayName}</span>
              <button
                onClick={() => setShowRoleSelector(true)}
                title="Switch User Profile"
                className="p-1 hover:bg-slate-800 rounded-full text-brand-yellow"
              >
                <UserIcon className="w-3 h-3" />
              </button>
              <button
                onClick={triggerSignOutFlow}
                title="Log out identity"
                className="p-1 text-slate-450 hover:text-red-400"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={triggerGoogleSignInFlow}
              className="inline-flex items-center gap-1 bg-brand-yellow text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-lg hover:brightness-110 transition cursor-pointer"
            >
              <LogIn className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPLIANT SIMPLIFIED BRAND HEADER */}
      <header className="border-b border-slate-900 bg-slate-950/40 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-yellow p-0.5 flex items-center justify-center shadow-lg shadow-brand-yellow/20">
              <div className="bg-slate-950 rounded-[10px] w-full h-full flex items-center justify-center">
                <Music className="w-5 h-5 text-slate-100" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  Bangkok Random Dance
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Official Random Dance in Thailand • @Bangkok.RandomDance
              </p>
            </div>
          </div>
 
          {/* Simple login panel (Desktop & Tablet only) */}
          <div className="hidden md:block">
            {authLoading ? (
              <div className="h-8 w-20 bg-slate-900 rounded-lg animate-pulse" />
            ) : currentUser ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full py-1 pl-1.5 pr-2.5 text-xs">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-6 h-6 rounded-full object-cover border border-brand-yellow"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-brand-yellow text-slate-950 flex items-center justify-center text-[10px] font-black">
                    {currentUser.displayName.charAt(0)}
                  </div>
                )}
                <span className="font-bold text-slate-200 truncate max-w-[100px] text-[11px]">{currentUser.displayName}</span>
                <button
                  onClick={() => setShowRoleSelector(true)}
                  title="Switch User Profile"
                  className="p-1 hover:bg-slate-800 rounded-full text-brand-yellow"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={triggerSignOutFlow}
                  title="Log out identity"
                  className="p-1 text-slate-400 hover:text-red-400"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={triggerGoogleSignInFlow}
                className="inline-flex items-center gap-1 bg-brand-yellow text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-lg hover:brightness-110 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CORE PORTAL VIEWPORT */}
      <main className="max-w-5xl w-full mx-auto p-4 flex-1 flex flex-col gap-6">

        {/* EVENT SPOTLIGHT INFORMATION & HISTORY SELECTOR */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" id="event-spotlight-banner">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              {userRole === 'user' && isActiveEventPast ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase bg-brand-yellow text-slate-950 px-2 py-0.5 rounded shadow shadow-brand-yellow/30">
                      EVENT STATUS
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Closed / Finished
                    </span>
                  </div>
                  <h2 className="text-base font-black text-white mt-1">
                    No Upcoming Event
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-brand-yellow font-bold">
                      Stay tuned for the next event announcement.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase bg-brand-yellow text-slate-950 px-2 py-0.5 rounded shadow shadow-brand-yellow/30">
                      EVENT SPOTLIGHT
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Gathering Requests Live
                    </span>
                  </div>
                  <h2 className="text-base font-black text-white mt-1">
                    {currentEvent.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-yellow-450" />
                      {currentEvent.place}
                    </span>
                    <span className="text-slate-800">•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-yellow-405 text-yellow-400" />
                      {formatEventTime(currentEvent.time)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {userRole === 'organizer' ? (
            <div className="w-full md:w-auto flex flex-col gap-1.5 min-w-[260px]">
              <label className="text-[9px] font-black uppercase text-slate-350 tracking-wider">
                📅 Change Event Scope / Check Prior Activity:
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-brand-yellow transition"
                id="event-focus-dropdown"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.place})
                  </option>
                ))}
              </select>
              
              <div className="mt-1 flex items-center justify-between gap-2 bg-slate-950/80 p-1.5 px-2.5 rounded-xl border border-slate-850">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  {selectedEventId === activeEventId ? "🎯 LIVE FOCUS" : "💤 BACKLOG VIEW"}
                </span>
                {selectedEventId !== activeEventId ? (
                  <button
                    onClick={() => handleToggleActiveEvent(selectedEventId)}
                    className="bg-brand-yellow hover:brightness-110 text-slate-950 text-[9px] font-black uppercase py-1 px-2.5 rounded-lg transition cursor-pointer shadow-sm shadow-brand-yellow/20"
                    type="button"
                  >
                    Set as Active
                  </button>
                ) : (
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>
          ) : (
            userRole === 'user' && isActiveEventPast ? (
              <div className="flex items-center gap-2 bg-slate-950/40 text-slate-400 border border-slate-800 px-3.5 py-2 rounded-2xl text-[11px] font-extrabold shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-600"></span>
                </span>
                <span>No upcoming event</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-2 rounded-2xl text-[11px] font-extrabold shadow-sm shadow-emerald-500/5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Up coming event</span>
              </div>
            )
          )}
        </div>

        {/* REINVERTED TRANSITION WRAPPER */}
        <AnimatePresence mode="wait">
          {userRole === 'user' ? (
            
            /* DANCER (USER) INTERACTIVE DECK */
            <motion.div
              key="dancer-panel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
              id="dancer-dancefloor-view"
            >
              {/* MOBILE/TABLET RESPONSIVE TABS Swapper - only visible on small screens (< lg) */}
              <div className="lg:hidden flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 sticky top-0 z-30 backdrop-blur-md gap-1">
                <button
                  type="button"
                  onClick={() => setMobileDancerTab('playlist')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[10px] font-black tracking-wider uppercase flex items-center justify-center gap-1.5 transition ${
                    mobileDancerTab === 'playlist'
                      ? 'bg-brand-yellow text-slate-950 font-black shadow-md shadow-brand-yellow/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Playlist</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileDancerTab('request')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[10px] font-black tracking-wider uppercase flex items-center justify-center gap-1.5 transition ${
                    mobileDancerTab === 'request'
                      ? 'bg-brand-yellow text-slate-950 font-black shadow-md shadow-brand-yellow/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Request</span>
                </button>
              </div>

              {/* GRID CONTAINER FOR MEDIUM/DESKTOP AND FALLBACK */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: CONTAINER WRAPPER */}
                <div className={`space-y-6 lg:col-span-5 ${mobileDancerTab === 'request' ? 'block' : 'hidden lg:block'}`}>
                  {/* STANDARD SUBMISSION FORM */}
                  <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden ${mobileDancerTab === 'request' ? 'block' : 'hidden lg:block'}`} id="dancer-request-panel">
                  <div className="absolute top-0 left-0 w-[4px] bg-gradient-to-b from-red-500 via-yellow-400 to-blue-500 h-full" />
                  
                  <h3 className="text-sm font-black text-white flex items-center gap-2 mb-1">
                    <span className="px-1 py-0.2 rounded bg-brand-yellow text-slate-950 text-[9px] font-black uppercase">REQUEST</span>
                    Song Request
                  </h3>
                  <p className="text-[11px] text-slate-455 leading-relaxed mb-4">
                    แนะนำเพลงที่ชอบ และท่อนที่ใช่ กันเข้ามาได้เลย หากว่าไม่แน่ใจว่ามีคนเคยขอหรือยัง ให้ลองพิมพ์เสริชเพื่อค้นหาและโหวตที่ด้านข้างเอานะ
                  </p>

                  {userRole === 'user' && isActiveEventPast ? (
                    <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-4 bg-slate-950/60 rounded-xl border border-slate-800/60 my-2">
                      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-450">
                        <Lock className="w-5 h-5 text-brand-yellow" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">
                          Song Request Closed
                        </h4>
                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mx-auto">
                          This event has already ended. Song request submissions are now closed for this session. Stay tuned for our future events!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestSubmit} className="space-y-4">
                      {/* Title field */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
                          Song Title / Track Name <span className="text-brand-yellow">*</span>
                        </label>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. Super Shy, Dynamite, Love Dive"
                          maxLength={100}
                          required
                          className="w-full bg-slate-950 border border-slate-800 focus:border-brand-yellow rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-650 transition outline-none"
                        />
                      </div>

                      {/* Artist field */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
                          Artist / Group Name <span className="text-brand-yellow">*</span>
                        </label>
                        <input
                          type="text"
                          value={newArtist}
                          onChange={(e) => setNewArtist(e.target.value)}
                          placeholder="e.g. NewJeans, BTS, IVE, aespa"
                          maxLength={100}
                          required
                          className="w-full bg-slate-950 border border-slate-800 focus:border-brand-yellow rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-650 transition outline-none"
                        />
                      </div>

                      {/* 3. Breakdance Toggle Row */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">
                          Performance Section <span className="text-slate-500 font-normal">(Optional)</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['Hook 1', 'Hook 2', 'Breakdance'] as const).map((part) => {
                            const isSelected = dancePart === part;
                            return (
                              <button
                                type="button"
                                key={part}
                                onClick={() => setDancePart(dancePart === part ? 'none' : part)}
                                className={`py-1.5 px-2 rounded-lg text-[10px] font-bold text-center border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-brand-yellow text-slate-950 border-brand-yellow font-extrabold shadow-sm shadow-brand-yellow/10'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-705'
                                }`}
                              >
                                {part}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. Youtube specific song link & timestamp */}
                      <div className="space-y-2 border-t border-slate-800/60 pt-3">
                        <span className="block text-[10px] font-black text-brand-yellow uppercase tracking-wide">
                          Reference เพิ่มเติมเพื่อความเป๊ะ
                        </span>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 mb-0.5">
                            YouTube Video Link
                          </label>
                          <input
                            type="url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-yellow rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-700 transition outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 mb-0.5">
                            Timestamp (Start - End)
                          </label>
                          <input
                            type="text"
                            value={timestamp}
                            onChange={(e) => setTimestamp(e.target.value)}
                            placeholder="e.g. 1:15 or 0:42"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-brand-yellow rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-700 transition outline-none"
                          />
                        </div>
                      </div>

                      {/* Alerts Container */}
                      <AnimatePresence mode="wait">
                        {formError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-red-950/40 border border-red-500/30 text-red-350 text-[11px] rounded-lg flex items-start gap-1.5 text-left"
                          >
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                            <span>{formError}</span>
                          </motion.div>
                        )}

                        {successNotification === 'created' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-350 text-[11px] rounded-lg flex items-center gap-1.5 text-left"
                          >
                            <PartyPopper className="w-4 h-4 text-emerald-450" />
                            <span>Success! Your song was added and registered.</span>
                          </motion.div>
                        )}

                        {successNotification === 'autovoted' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-yellow-950/40 border border-yellow-400/30 text-yellow-350 text-[11px] rounded-lg flex items-start gap-1.5 text-left"
                          >
                            <Check className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-extrabold text-white">Already in queue!</p>
                              <p className="text-[10px] text-yellow-450/80">
                                We converted your search directly to an upvote to push the choreography forward!
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 rounded-xl bg-brand-yellow text-slate-950 hover:brightness-110 active:scale-98 transition font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 shadow-brand-yellow/20"
                      >
                        {isSubmitting ? (
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Submit Song Request</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* LGBTQIA+ Support Box */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                    <div className="p-3 bg-slate-950 rounded-lg border border-yellow-400/10 text-left">
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                        <Heart className="w-3 h-3 text-red-505 fill-red-500 animate-pulse" />
                        <span>เราเชื่อว่าการเต้นคือการแบ่งปัน ดังนั้นถ้าขอแล้วไม่มาเต้นถือเป็นการเบียดเบียนคนอื่นและทำให้คนอื่นเสียโอกาส ไม่น่ารัก เป็นภัยคุกคามในวงการ ไม่เริ่ดนะหนู</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* PROMOTE POSTER (if instagramUrl exists on spotlight event) */}
                {currentEvent?.instagramUrl && (() => {
                  const igShortcode = getInstagramShortcode(currentEvent.instagramUrl);
                  return (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col hidden lg:flex" id="promote-instagram-poster">
                      <div className="absolute top-0 left-0 w-[4px] bg-gradient-to-b from-red-500 via-yellow-400 to-blue-500 h-full" />
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Instagram className="w-4.5 h-4.5 text-brand-yellow" />
                          <span>Promote Poster</span>
                        </h4>
                        <a
                          href={currentEvent.instagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-brand-yellow hover:underline font-black uppercase tracking-wider"
                        >
                          View Link ↗
                        </a>
                      </div>

                      {igShortcode ? (
                        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-850 aspect-[4/5] flex items-center justify-center group shadow-lg shadow-black/45">
                          <img
                            src={`https://www.instagram.com/p/${igShortcode}/media/?size=l`}
                            referrerPolicy="no-referrer"
                            alt="Instagram Promotional Poster"
                            className="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.src = `https://images.weserv.nl/?url=https://www.instagram.com/p/${igShortcode}/media/?size=l`;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 to-transparent pointer-events-none" />
                          <div className="absolute bottom-3 left-3 right-3 text-[10px] text-slate-350 font-black tracking-wide bg-slate-950/75 backdrop-blur-sm p-2 rounded-xl border border-slate-800 truncate flex items-center justify-between">
                            <span className="truncate">IG Code: @{igShortcode}</span>
                            <span className="text-brand-yellow">Instagram</span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-slate-950 border border-slate-850 py-8 px-4 flex flex-col items-center justify-center text-center">
                          <Instagram className="w-8 h-8 text-slate-700 mb-2" />
                          <p className="text-slate-400 text-xs font-bold font-mono">Instagram Associated Poster</p>
                          <a
                            href={currentEvent.instagramUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand-yellow hover:underline font-bold mt-1.5"
                          >
                            Open Reference Link ↗
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT COLUMN: CORE DASHBOARD SONGS FEED */}
              <div className={`lg:col-span-7 space-y-4 ${mobileDancerTab === 'playlist' ? 'block' : 'hidden lg:block'}`} id="voters-feed-dashboard">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-yellow-400" />
                      <span>Vote & Ranking</span>
                    </h3>
                    <p className="text-[11px] text-slate-450 mt-0.5">
                      ร่วมโหวตเพลงที่อยากเต้นให้อยู่ใน Playlist ได้ที่นี่ เพลงที่ขอจะมารวมกันตรงนี้นะจ๊ะ
                    </p>
                  </div>

                  {/* Search field */}
                  <div className="relative w-full sm:w-52">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, artist..."
                      className="w-full bg-slate-950 border border-slate-805 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-600 transition outline-none"
                    />
                  </div>
                </div>

                {/* Loading state indicator */}
                {loading ? (
                  <div className="py-16 text-center space-y-2 bg-slate-900/10 border border-slate-900 rounded-2xl">
                    <div className="w-7 h-7 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-500">Syncing live dance playlist...</p>
                  </div>
                ) : queryFilteredRequests.filter(r => r.status !== 'rejected').length === 0 ? (
                  <div className="py-20 text-center bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <Music className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-300">No matching requests found</h4>
                    <p className="text-[11px] text-slate-550 max-w-xs mx-auto mt-0.5">
                      Use the submission panel on the left to register your target choreography request first!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {queryFilteredRequests
                      .filter(r => r.status !== 'rejected')
                      .map((req, index) => {
                        const hasVoted = votedSongIds.includes(req.id);

                        return (
                          <div
                            key={req.id}
                            className="group bg-slate-900/70 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 text-left"
                            id={`request-${req.id}`}
                          >
                            <div className="flex items-start gap-3 truncate">
                              {/* Position */}
                              <div className="mt-0.5 flex-shrink-0 font-mono text-[11px] font-black w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                                #{index + 1}
                              </div>

                              <div className="truncate">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-yellow-400 transition truncate max-w-sm">
                                    {req.title}
                                  </h4>
                                  {req.dancePart && req.dancePart !== 'none' && (
                                    <span className="px-2 py-0.5 text-[9px] font-black bg-brand-yellow text-slate-950 rounded uppercase shadow shadow-brand-yellow/50">
                                      🎯 {req.dancePart}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-350 font-medium truncate">
                                  {req.artist}
                                </p>

                                {/* Dynamic badges */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-slate-450 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 truncate max-w-[150px]">
                                    <UserIcon className="w-2.5 h-2.5 text-yellow-500" />
                                    <span className="truncate">By {req.creatorName}</span>
                                  </span>

                                  {req.youtubeUrl && (
                                    <a
                                      href={req.youtubeUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-550/20"
                                      title="Open YouTube video"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Link className="w-2.5 h-2.5" />
                                      <span>YouTube Link</span>
                                      {req.timestamp && <span className="text-slate-500 ml-0.5">({req.timestamp})</span>}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Votes tally / Button */}
                            <div className="flex-shrink-0 min-w-[70px] text-right">
                              {hasVoted ? (
                                <button
                                  onClick={() => handleSongUnvoteAction(req.id)}
                                  className="group/voted px-3 py-1.5 rounded-lg bg-slate-950 border border-brand-yellow/30 text-brand-yellow text-xs transition duration-200 cursor-pointer flex flex-col items-center justify-center min-w-[75px] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 w-full"
                                  title="Unvote this track (Click to withdraw your vote)"
                                  type="button"
                                >
                                  <span className="flex items-center gap-1 font-black">
                                    <Check className="w-3.5 h-3.5 block group-hover/voted:hidden text-brand-yellow" />
                                    <X className="w-3.5 h-3.5 hidden group-hover/voted:block text-red-400" />
                                    <span>{req.votesCount}</span>
                                  </span>
                                  <span className="text-[8px] font-black uppercase mt-0.5 block group-hover/voted:hidden text-brand-yellow/70">Voted</span>
                                  <span className="text-[8px] font-black uppercase mt-0.5 hidden group-hover/voted:block text-red-400/80">Unvote</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSongUpvoteAction(req.id)}
                                  className="px-3 py-1.5 rounded-lg bg-brand-yellow hover:scale-105 active:scale-95 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1 justify-center w-full shadow-sm shadow-brand-yellow/10"
                                  title="Add upvote to this track recommendation"
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  <span>{req.votesCount}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

            </div> {/* Closing grid container */}

            {/* STANDALONE POSTER AT THE BOTTOM FOR MOBILE & TABLET */}
            {currentEvent?.instagramUrl && (() => {
              const igShortcode = getInstagramShortcode(currentEvent.instagramUrl);
              return (
                <div className="block lg:hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col mt-6" id="promote-instagram-poster-mobile">
                  <div className="absolute top-0 left-0 w-[4px] bg-gradient-to-b from-red-500 via-yellow-400 to-blue-500 h-full" />
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Instagram className="w-4.5 h-4.5 text-brand-yellow" />
                      <span>Promote Poster</span>
                    </h4>
                    <a
                      href={currentEvent.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-brand-yellow hover:underline font-black uppercase tracking-wider"
                    >
                      View Link ↗
                    </a>
                  </div>

                  {igShortcode ? (
                    <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-850 aspect-[4/5] flex items-center justify-center group shadow-lg shadow-black/45">
                      <img
                        src={`https://www.instagram.com/p/${igShortcode}/media/?size=l`}
                        referrerPolicy="no-referrer"
                        alt="Instagram Promotional Poster"
                        className="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = `https://images.weserv.nl/?url=https://www.instagram.com/p/${igShortcode}/media/?size=l`;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 to-transparent pointer-events-none" />
                      <div className="absolute bottom-3 left-3 right-3 text-[10px] text-slate-350 font-black tracking-wide bg-slate-950/75 backdrop-blur-sm p-2 rounded-xl border border-slate-800 truncate flex items-center justify-between">
                        <span className="truncate">IG Code: @{igShortcode}</span>
                        <span className="text-brand-yellow">Instagram</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-950 border border-slate-850 py-8 px-4 flex flex-col items-center justify-center text-center">
                      <Instagram className="w-8 h-8 text-slate-700 mb-2" />
                      <p className="text-slate-400 text-xs font-bold font-mono">Instagram Associated Poster</p>
                      <a
                        href={currentEvent.instagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-brand-yellow hover:underline font-bold mt-1.5"
                      >
                        Open Reference Link ↗
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        ) : (
            
            /* ORGANIZER (ADMIN) VIEW DIRECTIVES */
            <motion.div
              key="organizer-panel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
              id="organizer-dj-view"
            >
              
              {/* ADMIN MODE BANNER DETAILS */}
              <div className="bg-slate-900 border-2 border-brand-yellow rounded-2xl p-5 relative overflow-hidden shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 bg-brand-yellow text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                      <Crown className="w-3 h-3" />
                      Organizer Board
                    </div>
                    <h3 className="text-base font-extrabold text-white">Organizer Control Board</h3>
                    <p className="text-xs text-slate-400">
                      Manage track playing queues, configure event parameters, and easily moderate recommendations.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      onClick={() => setUserRole('user')}
                      className="px-2.5 py-1 rounded bg-brand-yellow hover:brightness-110 text-slate-950 font-black transition text-[10px] cursor-pointer"
                    >
                      Return to Fan Hub
                    </button>
                  </div>
                </div>
              </div>

              {/* SCHEDULE EVENT CREATION PORTLET */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden" id="creator-event-form">
                <div className="absolute top-0 left-0 w-[4px] bg-gradient-to-b from-red-500 via-yellow-400 to-blue-500 h-full" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-brand-yellow" />
                  <span>Create / Schedule Next Event Space</span>
                </h3>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  Every unique event handles its own isolated group of requests and ratings. Creating a new event will register it instantly into the live focus database pool.
                </p>

                <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="space-y-1 md:col-span-6 lg:col-span-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Event Name <span className="text-brand-yellow">*</span>
                    </label>
                    <input
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="e.g. Autumn PRIDE Random Dance"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 outline-none focus:border-brand-yellow transition"
                      required
                    />
                  </div>
                  
                  <div className="space-y-1 md:col-span-6 lg:col-span-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Place / Location <span className="text-brand-yellow">*</span>
                    </label>
                    <input
                      type="text"
                      value={newEventPlace}
                      onChange={(e) => setNewEventPlace(e.target.value)}
                      placeholder="e.g. Hongdae Walkway Plaza"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 outline-none focus:border-brand-yellow transition"
                      required
                    />
                  </div>

                  <div className="space-y-1 md:col-span-4 lg:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Date <span className="text-brand-yellow">*</span>
                    </label>
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-yellow transition [color-scheme:dark]"
                      required
                    />
                  </div>

                  <div className="space-y-1 md:col-span-4 lg:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Start <span className="text-brand-yellow">*</span>
                    </label>
                    <input
                      type="time"
                      value={newEventStartTime}
                      onChange={(e) => setNewEventStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-yellow transition [color-scheme:dark]"
                      required
                    />
                  </div>

                  <div className="space-y-1 md:col-span-4 lg:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      End <span className="text-slate-500 font-normal">(Opt)</span>
                    </label>
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-yellow transition [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-8 lg:col-span-10">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Instagram Link (Optional Poster)
                    </label>
                    <input
                      type="url"
                      value={newEventInstagramUrl}
                      onChange={(e) => setNewEventInstagramUrl(e.target.value)}
                      placeholder="https://www.instagram.com/p/..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-700 outline-none focus:border-brand-yellow transition"
                    />
                  </div>

                  <div className="md:col-span-4 lg:col-span-2">
                    <button
                      type="submit"
                      className="w-full bg-brand-yellow hover:brightness-110 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-brand-yellow/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Event</span>
                    </button>
                  </div>
                </form>

                <AnimatePresence>
                  {eventSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 text-[11px] text-emerald-400 font-extrabold flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Event successfully provisioned! Set as the active requests focus point.</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* DJ LIVE METRICS DATABASE BOARD */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 pb-3 border-b border-slate-850">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-350">
                      Complete Track Backlog & Organizer Tools
                    </h4>
                    <p className="text-[11px] text-slate-455 text-slate-400 mt-0.5">
                      Total list includes {requests.length} dance suggestions.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* View mode toggle */}
                    <div className="inline-flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        onClick={() => setOrganizerViewMode('ranked')}
                        className={`px-3 py-1 rounded transition cursor-pointer select-none ${
                          organizerViewMode === 'ranked'
                            ? 'bg-brand-yellow text-slate-950 font-black'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        type="button"
                      >
                        📊 Ranked List
                      </button>
                      <button
                        onClick={() => setOrganizerViewMode('grouped')}
                        className={`px-3 py-1 rounded transition cursor-pointer select-none ${
                          organizerViewMode === 'grouped'
                            ? 'bg-brand-yellow text-slate-950 font-black'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        type="button"
                      >
                        👥 Grouped by Requester
                      </button>
                    </div>

                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by title, group, dancer..."
                        className="w-full bg-slate-950 border border-slate-805 rounded-xl pl-7 pr-2.5 py-1 text-xs text-white placeholder-slate-650 transition outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* RESPONSIVE MOBILE & TABLET CARD VIEWS */}
                <div className="block lg:hidden space-y-3">
                  {organizerViewMode === 'grouped' ? (
                    groupedByRequesterRequests.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                        No tracks match current inquiry parameters.
                      </div>
                    ) : (
                      groupedByRequesterRequests.map((group) => (
                        <div key={group.creatorEmail + group.creatorName} className="bg-slate-950/40 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-850">
                          {/* Group Header */}
                          <div className="p-3 bg-slate-950/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 flex items-center justify-center text-[9px] font-black">
                                {group.creatorName.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-[11px] font-bold text-white">
                                {group.creatorName} <span className="text-[9px] text-slate-500">({group.creatorEmail})</span>
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow text-[8px] font-black uppercase">
                              {group.songs.length} requested
                            </span>
                          </div>

                          {/* Group Songs */}
                          {group.songs.map((req, miniIdx) => (
                            <div key={req.id} className="p-3 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-bold text-slate-400">#{miniIdx + 1}</span>
                                    <h5 className="text-xs font-bold text-white leading-tight">{req.title}</h5>
                                  </div>
                                  <p className="text-[10px] text-slate-405 text-slate-400 font-medium">{req.artist}</p>
                                </div>
                                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-brand-yellow font-bold text-[10px] flex-shrink-0">
                                  {req.votesCount} votes
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                {req.dancePart && req.dancePart !== 'none' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-brand-yellow/10 text-brand-yellow font-extrabold border border-brand-yellow/20 text-[8px] uppercase">
                                    🎯 {req.dancePart}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[9px]">No segment spec</span>
                                )}

                                {req.youtubeUrl && (
                                  <a
                                    href={req.youtubeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 hover:underline"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    <span>Youtube ref {req.timestamp && `(${req.timestamp})`}</span>
                                  </a>
                                )}
                              </div>

                              {/* Actions footer */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-905 border-slate-800">
                                {req.status === 'approved' || req.status === 'played' ? (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    In Playlist
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-black bg-slate-800 text-slate-300 border border-slate-700">
                                    Consider
                                  </span>
                                )}

                                <div className="flex gap-1.5">
                                  {req.status === 'approved' || req.status === 'played' ? (
                                    <button
                                      onClick={() => handleAdminStatusUpdate(req.id, 'pending')}
                                      className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[9px] font-bold transition flex items-center gap-0.5"
                                      type="button"
                                    >
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>Set Pending</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleAdminStatusUpdate(req.id, 'approved')}
                                      className="px-2 py-1 rounded bg-brand-yellow text-slate-950 text-[9px] font-black transition flex items-center gap-0.5"
                                      type="button"
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                      <span>Add Playlist</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleAdminDeleteSource(req.id)}
                                    className="px-2 py-1 rounded bg-slate-950 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-[9px] font-bold transition flex items-center gap-0.5"
                                    type="button"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )
                  ) : (
                    queryFilteredRequests.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                        No tracks match current inquiry parameters.
                      </div>
                    ) : (
                      queryFilteredRequests.map((req, index) => (
                        <div key={req.id} className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-brand-yellow">#{index + 1}</span>
                                <h5 className="text-xs font-bold text-white leading-tight">{req.title}</h5>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium">{req.artist}</p>
                            </div>
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-brand-yellow font-bold text-[10px] flex-shrink-0">
                              {req.votesCount} votes
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-450 bg-slate-950/60 p-1.5 rounded border border-slate-850/45">
                            <div>
                              <span className="block text-[8px] text-slate-500 font-semibold uppercase">Segment</span>
                              {req.dancePart && req.dancePart !== 'none' ? (
                                <span className="text-brand-yellow font-bold uppercase">{req.dancePart}</span>
                              ) : (
                                <span className="text-slate-500">Not specified</span>
                              )}
                            </div>
                            <div>
                              <span className="block text-[8px] text-slate-500 font-semibold uppercase">By Dancer</span>
                              <span className="truncate block max-w-full text-slate-350" title={req.creatorEmail}>{req.creatorName}</span>
                            </div>
                          </div>

                          {req.youtubeUrl && (
                            <div className="text-[10px] pt-1">
                              <a
                                href={req.youtubeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 hover:underline"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span>Youtube ref link {req.timestamp && `(${req.timestamp})`}</span>
                              </a>
                            </div>
                          )}

                          {/* Actions footer */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                            {req.status === 'approved' || req.status === 'played' ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                In Playlist
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] uppercase font-black bg-slate-800 text-slate-300 border border-slate-700">
                                Consider
                              </span>
                            )}

                            <div className="flex gap-1.5">
                              {req.status === 'approved' || req.status === 'played' ? (
                                <button
                                  onClick={() => handleAdminStatusUpdate(req.id, 'pending')}
                                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[9px] font-bold transition flex items-center gap-0.5"
                                  type="button"
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Pending</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAdminStatusUpdate(req.id, 'approved')}
                                  className="px-2 py-1 rounded bg-brand-yellow text-slate-950 text-[9px] font-black transition flex items-center gap-0.5"
                                  type="button"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Playlist</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleAdminDeleteSource(req.id)}
                                className="px-2 py-1 rounded bg-slate-950 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-[9px] font-bold transition flex items-center gap-0.5"
                                type="button"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>

                {/* DESKTOP VIEW DETAILED TABLE */}
                <div className="hidden lg:block overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                        <th className="py-2 px-1">Rank</th>
                        <th className="py-2 px-1">Track Detail</th>
                        <th className="py-2 px-1">Segment requested</th>
                        <th className="py-2 px-1">Dancer Contact</th>
                        <th className="py-2 px-1 text-center">Upvotes</th>
                        <th className="py-2 px-1">Status</th>
                        <th className="py-2 px-1 text-right">Moderator actions & queue control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {organizerViewMode === 'grouped' ? (
                        groupedByRequesterRequests.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500">
                              No tracks match current inquiry parameters.
                            </td>
                          </tr>
                        ) : (
                          groupedByRequesterRequests.map((group) => {
                            return (
                              <Fragment key={group.creatorEmail + group.creatorName}>
                                {/* Requester Group Section Header */}
                                <tr className="bg-slate-950/50">
                                  <td colSpan={7} className="py-3 px-3 border-y border-slate-800">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-6 h-6 rounded-full bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20 flex items-center justify-center text-[10px] font-black">
                                          {group.creatorName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <span className="font-extrabold text-white text-xs sm:text-sm">
                                            {group.creatorName}
                                          </span>
                                          <span className="text-[9px] text-slate-500 font-mono ml-2">
                                            ({group.creatorEmail})
                                          </span>
                                        </div>
                                      </div>
                                      <span className="px-2 py-0.5 rounded bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow text-[9px] font-black uppercase">
                                        {group.songs.length} {group.songs.length === 1 ? 'Request' : 'Requests'}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Songs requested by this person */}
                                {group.songs.map((req, miniIdx) => {
                                  return (
                                    <tr key={req.id} className="hover:bg-slate-850/15 transition pr-4">
                                      <td className="py-3 px-2 font-mono font-bold text-slate-500 text-center">
                                        {miniIdx + 1}
                                      </td>

                                      <td className="py-3 px-1">
                                        <p className="font-bold text-slate-100 text-[11px] sm:text-xs">
                                          {req.title}
                                        </p>
                                        <p className="text-slate-400 text-[10px] mt-0.5">
                                          {req.artist}
                                        </p>
                                        {req.youtubeUrl && (
                                          <a
                                            href={req.youtubeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[9px] text-blue-400 hover:underline flex items-center gap-0.5 mt-1"
                                          >
                                            <ExternalLink className="w-2.5 h-2.5" />
                                            <span>Reference URL</span>
                                            {req.timestamp && <span>({req.timestamp})</span>}
                                          </a>
                                        )}
                                      </td>

                                      <td className="py-3 px-1">
                                        {req.dancePart && req.dancePart !== 'none' ? (
                                          <span className="px-2 py-0.5 text-[9px] rounded-lg bg-brand-yellow/10 text-brand-yellow font-extrabold border border-brand-yellow/20 uppercase">
                                            {req.dancePart}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">Not Specified</span>
                                        )}
                                      </td>

                                      <td className="py-3 px-1 opacity-60">
                                        <span className="text-[10px] italic text-slate-455">Grouped at Header</span>
                                      </td>

                                      <td className="py-3 px-1 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-brand-yellow font-bold text-[11px]">
                                          {req.votesCount}
                                        </span>
                                      </td>

                                      <td className="py-3 px-1">
                                        {req.status === 'approved' || req.status === 'played' ? (
                                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-emerald-500/15 text-emerald-405 text-emerald-400 border border-emerald-500/20">
                                            In Playlist
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-slate-800 text-slate-300 border border-slate-700">
                                            Consider
                                          </span>
                                        )}
                                      </td>

                                      <td className="py-3 px-1 text-right">
                                        <div className="inline-flex gap-1.5 justify-end">
                                          {/* Toggle Status Button (In Playlist or Pending) */}
                                          {req.status === 'approved' || req.status === 'played' ? (
                                            <button
                                              onClick={() => handleAdminStatusUpdate(req.id, 'pending')}
                                              className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-805 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                              title="Set status to Pending / Consider"
                                              type="button"
                                            >
                                              <Clock className="w-3 h-3 text-slate-500" />
                                              <span>Pending</span>
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleAdminStatusUpdate(req.id, 'approved')}
                                              className="px-2.5 py-1 rounded bg-brand-yellow hover:scale-[1.03] text-slate-950 text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-sm shadow-brand-yellow/10"
                                              title="Set status to In Playlist"
                                              type="button"
                                            >
                                              <Check className="w-3 h-3" />
                                              <span>In Playlist</span>
                                            </button>
                                          )}

                                          {/* Delete button */}
                                          <button
                                            onClick={() => handleAdminDeleteSource(req.id)}
                                            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 hover:border-transparent text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                            title="Delete track from roster list"
                                            type="button"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Delete</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            );
                          })
                        )
                      ) : (
                        queryFilteredRequests.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500">
                              No tracks match current inquiry parameters.
                            </td>
                          </tr>
                        ) : (
                          queryFilteredRequests.map((req, index) => {
                            return (
                              <tr key={req.id} className="hover:bg-slate-850/20 transition">
                                
                                <td className="py-3 px-1 font-mono font-bold text-yellow-400">
                                  #{index + 1}
                                </td>

                                <td className="py-3 px-1">
                                  <p className="font-bold text-slate-100 text-[11px] sm:text-xs">
                                    {req.title}
                                  </p>
                                  <p className="text-slate-400 text-[10px] mt-0.5">
                                    {req.artist}
                                  </p>
                                  {req.youtubeUrl && (
                                    <a
                                      href={req.youtubeUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[9px] text-blue-400 hover:underline flex items-center gap-0.5 mt-1"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                      <span>Reference URL</span>
                                      {req.timestamp && <span>({req.timestamp})</span>}
                                    </a>
                                  )}
                                </td>

                                <td className="py-3 px-1">
                                  {req.dancePart && req.dancePart !== 'none' ? (
                                    <span className="px-2 py-0.5 text-[9px] rounded-lg bg-brand-yellow/10 text-brand-yellow font-extrabold border border-brand-yellow/20 uppercase">
                                      {req.dancePart}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Not Specified</span>
                                  )}
                                </td>

                                <td className="py-3 px-1">
                                  <p className="text-slate-300 font-bold">{req.creatorName}</p>
                                  <p className="text-[9px] text-slate-500 font-mono mt-0.1">{req.creatorEmail}</p>
                                </td>

                                <td className="py-3 px-1 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-yellow-450 font-bold text-[11px]">
                                    {req.votesCount}
                                   </span>
                                 </td>

                                 <td className="py-3 px-1">
                                  {req.status === 'approved' || req.status === 'played' ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                      In Playlist
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-slate-800 text-slate-300 border border-slate-700">
                                      Consider
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-1 text-right">
                                  <div className="inline-flex gap-1.5 justify-end">
                                    {/* Toggle Status Button (In Playlist or Pending) */}
                                    {req.status === 'approved' || req.status === 'played' ? (
                                      <button
                                        onClick={() => handleAdminStatusUpdate(req.id, 'pending')}
                                        className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                        title="Set status to Pending / Consider"
                                        type="button"
                                      >
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        <span>Pending</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleAdminStatusUpdate(req.id, 'approved')}
                                        className="px-2.5 py-1 rounded bg-brand-yellow hover:scale-[1.03] text-slate-950 text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-sm shadow-brand-yellow/10"
                                        title="Set status to In Playlist"
                                        type="button"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>In Playlist</span>
                                      </button>
                                    )}

                                    {/* Delete button */}
                                    <button
                                      onClick={() => handleAdminDeleteSource(req.id)}
                                      className="px-2.5 py-1 rounded bg-slate-950 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 hover:border-transparent text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                      title="Delete track from roster list"
                                      type="button"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </td>

                              </tr>
                            );
                          })
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* POPUP SIMULATION IDENTITY ADJUSTER */}
      <AnimatePresence>
        {showRoleSelector && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border-2 border-yellow-400 max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl relative"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-[#E40303] via-[#FF8C00] via-[#FFED00] via-[#008026] via-[#004CFF] to-[#732982]" />

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4 text-yellow-400" />
                    <span>Select Simulated Identity</span>
                  </h3>
                  <button
                    onClick={() => setShowRoleSelector(false)}
                    className="p-1 hover:bg-slate-800 rounded-full transition cursor-pointer"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-normal">
                  Toggle different attendee profiles below to simulate multi-user support, test vote tallies, or review administrative views.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => handleSimulatedProfileSwitch({
                      uid: 'user_lisa',
                      displayName: 'Lisa Park',
                      email: 'lisa.dance@gmail.com'
                    })}
                    className="w-full p-2.5 rounded-lg bg-slate-950 hover:bg-yellow-400 hover:text-slate-950 text-left transition flex items-center gap-2 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-yellow-300">LP</div>
                    <div>
                      <p className="text-xs font-bold">Lisa Park</p>
                      <p className="text-[10px] text-slate-450">lisa.dance@gmail.com (Dancer)</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSimulatedProfileSwitch({
                      uid: 'user_angelique',
                      displayName: 'Angelique DJ',
                      email: 'Digimon.Angelique@gmail.com'
                    })}
                    className="w-full p-2.5 rounded-lg bg-slate-950 hover:bg-yellow-400 hover:text-slate-950 text-left transition flex items-center gap-2 border border-yellow-400/40 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center text-xs font-black font-serif">DJ</div>
                    <div>
                      <p className="text-xs font-black">Angelique (Event Organizer)</p>
                      <p className="text-[10px] text-slate-450">Digimon.Angelique@gmail.com [DJ]</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSimulatedProfileSwitch({
                      uid: 'user_dancer',
                      displayName: 'Sunny Dancer',
                      email: 'dancer@prideflow.org'
                    })}
                    className="w-full p-2.5 rounded-lg bg-slate-950 hover:bg-yellow-400 hover:text-slate-950 text-left transition flex items-center gap-2 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-brand-yellow font-serif">SD</div>
                    <div>
                      <p className="text-xs font-bold">Sunny Dancer</p>
                      <p className="text-[10px] text-slate-450">dancer@prideflow.org (Attendee)</p>
                    </div>
                  </button>
                </div>

                <div className="text-[10px] text-slate-500 text-center leading-tight">
                  Clicking switch instantly simulates a new auth state!
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 px-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto space-y-1.5">
          <p className="font-semibold text-slate-400 flex items-center justify-center gap-1">
            พื้นที่ของบางกอกระบำสุ่ม Bangkok Random Dance เป็นพื้นที่ SafeSpace สำหรับทุกคน.
          </p>
          <p className="text-[10px] text-slate-500">
            Bangkok Random Dance • For work contact 094-9422597 K.Mind
          </p>
        </div>
      </footer>

    </div>
  );
}
