"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow, format, isValid, parseISO } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { getDeezerData } from "./actions";

// --- CONFIGURATION ---
const TRENDING_PLAYLIST_ID = "3155776842";

const COLORS = {
    bg: '#0a0c0f',
    surface: 'rgba(255, 255, 255, 0.03)',
    accent: '#f97316',
    textMuted: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.1)',
    track: '#3b82f6',
    album: '#f97316',
    green: '#22c55e',
    red: '#ef4444'
};
const DEFAULT_IMG = "https://via.placeholder.com/300/1b2228/f97316?text=No+Cover";
const GENRES_KEYS = ["Rap", "Pop", "Rock", "Electro", "R&B", "Jazz", "Metal", "Classical", "Variety"];
const SEARCH_TAGS = ["Rap Fr", "US Rap", "Pop 2024", "Rock Classics", "Electro House", "Jazz Vibes"];

const TRANSLATIONS: any = {
    fr: {
        discover: "Découverte", search: "Recherche", activity: "Activité", profile: "Profil", digger: "Digger",
        top_hits: "Top Hits Monde", top_desc: "La playlist officielle.", daily_drop: "SON DU JOUR",
        categories: "CATÉGORIES", recent: "RÉCENT", friends: "AMIS", me: "MOI",
        albums: "ALBUMS", tracks: "SONS", rated: "Notés", watchlist: "Watchlist", publish: "PUBLIER",
        average: "MOYENNE", reviews: "Avis", reply: "Répondre", send: "Envoyer",
        unknown_artist: "Artiste Inconnu", unknown_title: "Titre Inconnu", compatible: "Compatible",
        choose_anthem: "Choisir mon Hymne 🎵", logout: "Se déconnecter", follow: "Suivre", following: "Abonné",
        followers: "ABONNÉS", following_count: "ABONNEMENTS", items_count: "TITRES",
        search_placeholder: "Rechercher...", search_friend: "🔍 Trouver un ami...", your_review: "Ton avis...",
        user_stats_title: "DISTRIBUTION DES NOTES", settings: "Paramètres", save: "Enregistrer",
        change_photo: "Changer la photo", bio_placeholder: "Parle-nous de toi...",
        username_taken: "Ce pseudo est déjà pris !", username_label: "Pseudo", bio_label: "Bio",
        journal: "Journal", lists: "Listes", create_list: "Créer une liste", list_name: "Nom de la liste",
        add_to_list: "Ajouter à une liste", you_might_like: "Tu aimeras aussi...", notifications: "Notifications",
        no_notifs: "Aucune notification", create: "Créer", back: "Retour", empty_list: "Cette liste est vide.",
        listen: "▶ ÉCOUTER", pause: "⏸ PAUSE", pass: "Passer", keep: "Garder", start_digger: "LANCER LE DIGGER 🎵",
        loading: "Recherche personnalisée...",
        "Rap": "Rap", "Pop": "Pop", "Rock": "Rock", "Electro": "Electro", "R&B": "R&B", "Jazz": "Jazz", "Metal": "Metal", "Classical": "Classique", "Variety": "Variété"
    },
    en: {
        discover: "Discover", search: "Search", activity: "Activity", profile: "Profile", digger: "Digger",
        top_hits: "Global Top Hits", top_desc: "The official playlist.", daily_drop: "DAILY DROP",
        categories: "CATEGORIES", recent: "RECENT", friends: "FRIENDS", me: "ME",
        albums: "ALBUMS", tracks: "TRACKS", rated: "Rated", watchlist: "Watchlist", publish: "PUBLISH",
        average: "AVERAGE", reviews: "Reviews", reply: "Reply", send: "Send",
        unknown_artist: "Unknown Artist", unknown_title: "Unknown Title", compatible: "Compatible",
        choose_anthem: "Pick my Anthem 🎵", logout: "Log out", follow: "Follow", following: "Following",
        followers: "FOLLOWERS", following_count: "FOLLOWING", items_count: "ITEMS",
        search_placeholder: "Search...", search_friend: "🔍 Find a friend...", your_review: "Your review...",
        user_stats_title: "RATING DISTRIBUTION", settings: "Settings", save: "Save",
        change_photo: "Change Photo", bio_placeholder: "Tell us about you...",
        username_taken: "Username already taken!", username_label: "Username", bio_label: "Bio",
        journal: "Journal", lists: "Lists", create_list: "Create List", list_name: "List Name",
        add_to_list: "Add to list", you_might_like: "You might like...", notifications: "Notifications",
        no_notifs: "No notifications", create: "Create", back: "Back", empty_list: "This list is empty.",
        listen: "▶ LISTEN", pause: "⏸ PAUSE", pass: "Pass", keep: "Keep", start_digger: "START DIGGER 🎵",
        loading: "Digging for gems...",
        "Rap": "Rap", "Pop": "Pop", "Rock": "Rock", "Electro": "Electro", "R&B": "R&B", "Jazz": "Jazz", "Metal": "Metal", "Classical": "Classical", "Variety": "Variety"
    }
};

const Visualizer = () => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '30px', position: 'absolute', bottom: '25px', left: '25px', zIndex: 10 }}>
        {[1, 2, 3, 4, 5].map(i => (
            <motion.div
                key={i}
                animate={{ height: [5, 25, 10, 30, 5] }}
                transition={{ repeat: Infinity, duration: 0.4 + Math.random() * 0.4, ease: "easeInOut" }}
                style={{ width: '6px', background: COLORS.accent, borderRadius: '3px' }}
            />
        ))}
    </div>
);

export default function Home() {
    // --- ETATS ---
    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [authMode, setAuthMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [newUsername, setNewUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [lang, setLang] = useState<"fr" | "en">("fr");

    // UI States
    const [activeTab, setActiveTab] = useState("discover");
    const [profileTab, setProfileTab] = useState("rated");
    const [subTabActivity, setSubTabActivity] = useState("friends");
    const [showSettings, setShowSettings] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const [socialModal, setSocialModal] = useState<"followers" | "following" | null>(null);
    const [socialList, setSocialList] = useState<any[]>([]);

    const [tempPseudo, setTempPseudo] = useState("");
    const [tempBio, setTempBio] = useState("");
    const [tempAvatar, setTempAvatar] = useState("");

    const [library, setLibrary] = useState<any[]>([]);
    const [myLists, setMyLists] = useState<any[]>([]);
    const [myFollows, setMyFollows] = useState<string[]>([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [viewedProfile, setViewedProfile] = useState<any>(null);
    const [viewedLibrary, setViewedLibrary] = useState<any[]>([]);
    const [viewedLists, setViewedLists] = useState<any[]>([]);

    const [userQuery, setUserQuery] = useState("");
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [trending, setTrending] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [query, setQuery] = useState("");
    const [searchType, setSearchType] = useState("track");
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    const [showAnthemSearch, setShowAnthemSearch] = useState(false);
    const [anthemQuery, setAnthemQuery] = useState("");
    const [anthemResults, setAnthemResults] = useState<any[]>([]);

    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [itemDetails, setItemDetails] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [showListModal, setShowListModal] = useState(false);
    const [newListTitle, setNewListTitle] = useState("");
    const [openedList, setOpenedList] = useState<any>(null);
    const [openedListItems, setOpenedListItems] = useState<any[]>([]);

    // DIGGER MODE INTELLIGENT
    const [diggerStack, setDiggerStack] = useState<any[]>([]);
    const [isFetchingDigger, setIsFetchingDigger] = useState(false);
    const [diggerStarted, setDiggerStarted] = useState(false);
    const [currentDiggerIndex, setCurrentDiggerIndex] = useState(0);
    const [watchlistedIds, setWatchlistedIds] = useState<string[]>([]);
    const [seenTracks, setSeenTracks] = useState<Set<string>>(new Set());

    const [communityComments, setCommunityComments] = useState<any[]>([]);
    const [friendsActivity, setFriendsActivity] = useState<any[]>([]);

    const [rating, setRating] = useState(0);
    const [review, setReview] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("Pop");
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [replyText, setReplyText] = useState("");
    const [likedComments, setLikedComments] = useState<number[]>([]);

    const audioRef = useRef<HTMLAudioElement>(null);
    const [playingUri, setPlayingUri] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const diggerContainerRef = useRef<HTMLDivElement>(null);

    const t = (key: string) => TRANSLATIONS[lang][key] || key;

    // --- HELPERS ---
    const getArtist = (item: any) => (item.artist && typeof item.artist === 'object') ? item.artist.name : (item.artist || t('unknown_artist'));
    const getCover = (item: any) => item.cover_medium || item.cover_xl || item.album?.cover_medium || item.image || DEFAULT_IMG;
    const getTitle = (item: any) => item.title || item.name || t('unknown_title');
    const getType = (item: any) => item.type || (item.record_type === 'track' ? 'track' : 'album');
    const getKey = (item: any) => `${getType(item)}:${getArtist(item)} - ${getTitle(item)}`;
    const getSafeDate = (dateString: any) => {
        if (!dateString) return new Date();
        const date = parseISO(dateString);
        return isValid(date) ? date : new Date();
    };

    // --- INIT ---
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) initUser(session.user.id, session.user.email || "");
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) initUser(session.user.id, session.user.email || "");
            else { setProfile(null); setLibrary([]); setMyFollows([]); }
        });
        const savedSearches = localStorage.getItem("mb_recent_searches");
        if (savedSearches) setRecentSearches(JSON.parse(savedSearches));

        // Charger l'historique des sons vus
        const savedSeen = localStorage.getItem("mb_seen_tracks");
        if (savedSeen) setSeenTracks(new Set(JSON.parse(savedSeen)));

        const savedLang = localStorage.getItem("mb_lang");
        if (savedLang === "en" || savedLang === "fr") setLang(savedLang);
        return () => subscription.unsubscribe();
    }, []);

    const initUser = async (userId: string, userEmail: string) => {
        let { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!p) {
            const autoUsername = userEmail.split('@')[0] + Math.floor(Math.random() * 1000);
            const { data: newProfile } = await supabase.from('profiles').insert([
                { id: userId, username: autoUsername, avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${autoUsername}` }
            ]).select().single();
            if (newProfile) p = newProfile;
        }
        if (p) {
            setProfile(p);
            setTempPseudo(p.username); setTempBio(p.bio || ""); setTempAvatar(p.avatar_url);
        }
        const { data: lib } = await supabase.from('library').select('*').eq('user_id', userId);
        if (lib) {
            setLibrary(lib);
            setWatchlistedIds(lib.filter((x: any) => x.is_watchlist).map((x: any) => x.album_key));
        }
        const { data: lists } = await supabase.from('lists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (lists) setMyLists(lists);
        fetchNotifications(userId);
        fetchMySocials(userId);
    };

    const fetchNotifications = async (userId: string) => {
        const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
        if (data) { setNotifications(data); setHasUnread(data.some((n: any) => !n.is_read)); }
    };

    const fetchMySocials = async (userId: string) => {
        const { data: following } = await supabase.from('follows').select('following_username').eq('follower_id', userId);
        if (following) {
            const follows = following.map(f => f.following_username);
            setMyFollows(follows);
            fetchFriendsActivity(follows);
        }
    };

    // --- DATA LOGIC ---
    const myRated = useMemo(() => library.filter(x => x.rating > 0).sort((a, b) => getSafeDate(b.created_at).getTime() - getSafeDate(a.created_at).getTime()), [library]);
    const myWatchlist = useMemo(() => library.filter(x => x.is_watchlist), [library]);
    const myTop4 = useMemo(() => library.filter(x => x.is_top4).slice(0, 4), [library]);
    const viewedRated = useMemo(() => viewedLibrary.filter(x => x.rating > 0).sort((a, b) => getSafeDate(b.created_at).getTime() - getSafeDate(a.created_at).getTime()), [viewedLibrary]);
    const viewedWatchlist = useMemo(() => viewedLibrary.filter(x => x.is_watchlist), [viewedLibrary]);
    const viewedTop4 = useMemo(() => viewedLibrary.filter(x => x.is_top4).slice(0, 4), [viewedLibrary]);

    const matchScore = useMemo(() => {
        if (!viewedProfile || viewedLibrary.length === 0 || library.length === 0) return 0;
        let score = 0;
        const myKeys = myRated.map(a => a.album_key); const theirKeys = viewedRated.map(a => a.album_key);
        const common = myKeys.filter(k => theirKeys.includes(k)); score += Math.min(common.length * 10, 60);
        return score > 99 ? 99 : score;
    }, [viewedProfile, viewedLibrary, library, myRated, viewedRated]);

    // --- FETCHES ---
    useEffect(() => {
        const fetchRealTrends = async () => {
            const data = await getDeezerData(`/playlist/${TRENDING_PLAYLIST_ID}/tracks?limit=50`);
            if (data.data) {
                const tracks = data.data.map((t: any) => ({ ...t, type: 'track' }));
                setTrending(tracks);
                if (diggerStack.length === 0) loadMoreDigger(tracks);
            }
            fetchGlobalActivity();
        };
        fetchRealTrends();
    }, []);

    const dailyDrop = useMemo(() => {
        if (trending.length === 0) return null;
        const randomIndex = new Date().getDate() % Math.min(trending.length, 10);
        return trending[randomIndex];
    }, [trending]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2) {
                const endpoint = searchType === 'album' ? '/search/album' : '/search/track';
                const data = await getDeezerData(`${endpoint}?q=${query}`);
                setSearchResults((data.data || []).map((item: any) => ({ ...item, type: searchType })));
                if (!recentSearches.includes(query)) {
                    const newRecents = [query, ...recentSearches].slice(0, 5);
                    setRecentSearches(newRecents);
                    localStorage.setItem("mb_recent_searches", JSON.stringify(newRecents));
                }
            } else setSearchResults([]);
        }, 400);
        return () => clearTimeout(timer);
    }, [query, searchType]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (anthemQuery.length > 2) {
                const data = await getDeezerData(`/search/track?q=${anthemQuery}`);
                setAnthemResults(data.data || []);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [anthemQuery]);

    // --- DIGGER LOGIC V4 (PERSONALIZED & RESET) ---
    useEffect(() => {
        if (activeTab === 'digger') {
            setDiggerStarted(false);
            setDiggerStack([]);
            setCurrentDiggerIndex(0);
            loadMoreDigger();
        } else {
            // STOP AUDIO COMPLETELY WHEN LEAVING TAB
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setPlayingUri(null);
        }
    }, [activeTab]);

    const loadMoreDigger = async (initialTracks?: any[]) => {
        if (isFetchingDigger) return;
        setIsFetchingDigger(true);
        let newTracks: any[] = [];
        let attempts = 0;

        // ALGO DE PERSONNALISATION
        // 1. Récupérer les artistes favoris (notés >= 3)
        const favoriteArtists = library
            .filter(t => t.rating >= 3)
            .map(t => t.artist);

        // 2. Récupérer les genres favoris
        const favoriteGenres = library
            .filter(t => t.rating >= 3 && t.genre)
            .map(t => t.genre);

        while (newTracks.length < 5 && attempts < 6) {
            let apiUrl = "";
            const randomOffset = Math.floor(Math.random() * 500);

            // Choix de la stratégie de recherche (70% Personnalisé / 30% Découverte)
            if (Math.random() < 0.7 && (favoriteArtists.length > 0 || favoriteGenres.length > 0)) {
                if (favoriteArtists.length > 0 && Math.random() > 0.5) {
                    // Recherche par artiste similaire (approx. via recherche artiste)
                    const artist = favoriteArtists[Math.floor(Math.random() * favoriteArtists.length)];
                    apiUrl = `/search/track?q=artist:"${artist}"&index=${randomOffset}&limit=25`;
                } else if (favoriteGenres.length > 0) {
                    // Recherche par genre favori
                    const genre = favoriteGenres[Math.floor(Math.random() * favoriteGenres.length)];
                    apiUrl = `/search/track?q=genre:"${genre}"&index=${randomOffset}&limit=25`;
                }
            } else {
                // Découverte : Genres populaires
                const genres = ["rap", "pop", "rock", "electro", "r&b", "lofi"];
                const randomGenre = genres[Math.floor(Math.random() * genres.length)];
                apiUrl = `/search/track?q=genre:"${randomGenre}"&index=${randomOffset}&limit=25`;
            }

            // Fallback si pas de critères
            if (!apiUrl) apiUrl = `/chart/0/tracks?index=${randomOffset}&limit=25`;

            const data = await getDeezerData(apiUrl);

            if (data.data) {
                const fetched = data.data.map((t: any) => ({ ...t, type: 'track' }));
                // FILTRE STRICT : On retire ce qui est déjà vu
                const filtered = fetched.filter((t: any) => !seenTracks.has(String(t.id)));
                newTracks = [...newTracks, ...filtered];
            }
            attempts++;
        }

        if (newTracks.length > 0) {
            // Dédoublonnage et mélange
            const uniqueNew = Array.from(new Set(newTracks.map(t => t.id)))
                .map(id => newTracks.find(t => t.id === id));
            setDiggerStack(prev => [...prev, ...uniqueNew.sort(() => 0.5 - Math.random())]);
        }
        setIsFetchingDigger(false);
    };

    // --- LOGIQUE DE SCROLL & AUTO PLAY ---
    const handleDiggerScroll = (e: any) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 300) loadMoreDigger();

        const index = Math.round(scrollTop / clientHeight);

        if (index !== currentDiggerIndex) {
            // STOP AUDIO IMMEDIAT
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }

            setCurrentDiggerIndex(index);

            if (diggerStack[index]) {
                const newId = String(diggerStack[index].id);
                setSeenTracks(prev => {
                    const newSet = new Set(prev).add(newId);
                    localStorage.setItem("mb_seen_tracks", JSON.stringify(Array.from(newSet)));
                    return newSet;
                });
                // PLAY ONLY IF STARTED
                if (diggerStarted) playPreview(diggerStack[index].preview);
            }
        }
    };

    const toggleDiggerWatchlist = async (item: any) => {
        const key = getKey(item);
        if (watchlistedIds.includes(key)) {
            setWatchlistedIds(prev => prev.filter(k => k !== key));
            await updateLibraryItem(item, { is_watchlist: false });
        } else {
            setWatchlistedIds(prev => [...prev, key]);
            await updateLibraryItem(item, { is_watchlist: true });
        }
    };

    // --- ACTIONS ---
    const handleImageUpload = (e: any) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setTempAvatar(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const saveSettings = async () => {
        setLoading(true);
        if (tempPseudo !== profile.username) {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('username', tempPseudo);
            if (count && count > 0) { setLoading(false); return alert(t('username_taken')); }
        }
        const { error } = await supabase.from('profiles').update({ username: tempPseudo, bio: tempBio, avatar_url: tempAvatar }).eq('id', session.user.id);
        if (!error) { setProfile({ ...profile, username: tempPseudo, bio: tempBio, avatar_url: tempAvatar }); setShowSettings(false); }
        setLoading(false);
    };

    const updateLibraryItem = async (item: any, updates: any) => {
        if (!session || !profile) return alert("Connecte-toi !");
        const key = getKey(item);
        const existingItem = library.find(x => x.album_key === key);
        const createdDate = existingItem?.created_at ? existingItem.created_at : new Date().toISOString();
        const newItem = {
            user_id: session.user.id, album_key: key, title: getTitle(item), artist: getArtist(item), image: getCover(item),
            type: getType(item), genre: existingItem?.genre || "Pop", rating: existingItem?.rating || 0, is_watchlist: existingItem?.is_watchlist || false, is_top4: existingItem?.is_top4 || false, ...updates,
            created_at: createdDate
        };
        if (existingItem) setLibrary(library.map(x => x.album_key === key ? { ...x, ...updates } : x));
        else setLibrary([...library, newItem]);
        await supabase.from('library').upsert(newItem, { onConflict: 'user_id, album_key' });
    };

    // FIX AUDIO ON MODAL OPEN
    const openItemModal = (item: any) => {
        setSelectedItem(item);
        if (audioRef.current) {
            audioRef.current.pause();
            setPlayingUri(null); // Ensure state reflects pause
        }
    };

    // EFFECT TO HANDLE MODAL CLOSING
    useEffect(() => {
        if (!selectedItem && activeTab === 'digger' && diggerStarted && diggerStack[currentDiggerIndex]) {
            // Resume digger music if we close modal and we are in digger
            playPreview(diggerStack[currentDiggerIndex].preview);
        }
    }, [selectedItem]);

    const handleRate = async () => {
        await updateLibraryItem(selectedItem, { rating: rating, review: review, genre: selectedGenre });
        await supabase.from('comments').insert([{ album_id: getKey(selectedItem), username: profile.username, content: review, rating, image: getCover(selectedItem), likes: 0, type: getType(selectedItem) }]);
        fetchSupabaseComments(selectedItem); setReview(""); alert("Note sauvegardée !");
    };

    const setAnthem = async (track: any) => {
        if (!profile) return;
        setProfile({ ...profile, anthem_title: track.title, anthem_url: track.preview });
        await supabase.from('profiles').update({ anthem_title: track.title, anthem_url: track.preview }).eq('id', session.user.id);
        setShowAnthemSearch(false);
    };

    const createList = async () => {
        if (!newListTitle.trim()) return;
        const { data, error } = await supabase.from('lists').insert([{ user_id: session.user.id, title: newListTitle }]).select().single();
        if (!error && data) { setMyLists([data, ...myLists]); setNewListTitle(""); }
    };

    const addToList = async (listId: string) => {
        if (!selectedItem) return;
        await supabase.from('list_items').insert([{ list_id: listId, item_key: getKey(selectedItem), title: getTitle(selectedItem), artist: getArtist(selectedItem), image: getCover(selectedItem), type: getType(selectedItem) }]);
        setShowListModal(false); alert("Ajouté à la liste !");
    };

    const openList = async (list: any) => {
        setOpenedList(list);
        const { data } = await supabase.from('list_items').select('*').eq('list_id', list.id);
        setOpenedListItems(data || []);
    };

    const sendNotification = async (targetUserId: string, type: string, content: string) => {
        if (targetUserId === session.user.id) return;
        await supabase.from('notifications').insert([{ user_id: targetUserId, from_username: profile.username, type, content }]);
    };

    const markNotifsRead = async () => {
        setHasUnread(false);
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id);
    };

    const toggleWatchlist = (e: any, item: any) => { e.stopPropagation(); const key = getKey(item); const current = library.find(x => x.album_key === key); updateLibraryItem(item, { is_watchlist: !current?.is_watchlist }); };
    const toggleTopFour = (item: any) => { const key = getKey(item); const current = library.find(x => x.album_key === key); if (!current?.is_top4 && myTop4.length >= 4) return alert("Top 4 complet !"); updateLibraryItem(item, { is_top4: !current?.is_top4 }); };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true);
        if (authMode === "login") { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) alert(error.message); }
        else { const { data, error } = await supabase.auth.signUp({ email, password }); if (error) alert(error.message); else if (data.user) { await supabase.from('profiles').insert([{ id: data.user.id, username: newUsername, avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUsername}` }]); alert("Compte créé !"); setAuthMode("login"); } }
        setLoading(false);
    };
    const handleLogout = async () => { await supabase.auth.signOut(); setLibrary([]); setMyFollows([]); setMyLists([]); };

    const toggleFollow = async (targetUsername: string) => {
        if (!session) return alert("Connecte-toi !");
        const { data: targetUser } = await supabase.from('profiles').select('id').eq('username', targetUsername).single();
        if (myFollows.includes(targetUsername)) {
            await supabase.from('follows').delete().match({ follower_id: session.user.id, following_username: targetUsername });
            setMyFollows(myFollows.filter(u => u !== targetUsername));
        } else {
            await supabase.from('follows').insert([{ follower_id: session.user.id, following_username: targetUsername }]);
            setMyFollows([...myFollows, targetUsername]);
            if (targetUser) sendNotification(targetUser.id, 'follow', 'a commencé à te suivre');
        }
    };

    const loadUserProfile = async (targetUsername: string) => {
        if (profile && targetUsername === profile.username) { setViewedProfile(null); setActiveTab("account"); return; }
        const { data: userProfile } = await supabase.from('profiles').select('*').eq('username', targetUsername).single();
        if (userProfile) {
            const { data: lib } = await supabase.from('library').select('*').eq('user_id', userProfile.id);
            const { data: lists } = await supabase.from('lists').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false });
            setViewedLibrary(lib || []);
            setViewedLists(lists || []);
            const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_username', targetUsername);
            setViewedProfile({ ...userProfile, followers: count });
            setActiveTab("account");
        }
        setSocialModal(null);
    };
    const fetchFriendsActivity = async (follows: string[]) => { if (follows.length === 0) { setFriendsActivity([]); return; } const { data } = await supabase.from('comments').select('*').in('username', follows).order('created_at', { ascending: false }).limit(30); if (data) setFriendsActivity(data); };
    const fetchSupabaseComments = async (item: any) => { const { data } = await supabase.from('comments').select('*').eq('album_id', getKey(item)).order('created_at', { ascending: false }); if (data) setCommunityComments(data); };
    const fetchGlobalActivity = async () => { const { data } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(50); if (data) setFriendsActivity(data); };
    const saveReply = async (parent: any) => { if (!replyText.trim()) return; await supabase.from('comments').insert([{ album_id: getKey(selectedItem), username: profile.username, content: replyText, rating: 0, parent_id: parent.id, image: getCover(selectedItem), likes: 0 }]); setReplyTo(null); setReplyText(""); fetchSupabaseComments(selectedItem); };

    const handleLike = async (id: number, cLikes: number) => {
        if (!session) return;
        if (likedComments.includes(id)) return;
        setCommunityComments(prev => prev.map(c => c.id === id ? { ...c, likes: cLikes + 1 } : c));
        setLikedComments([...likedComments, id]);
        await supabase.from('comments').update({ likes: cLikes + 1 }).eq('id', id);
        const comment = communityComments.find(c => c.id === id);
        if (comment) {
            const { data: author } = await supabase.from('profiles').select('id').eq('username', comment.username).single();
            if (author) sendNotification(author.id, 'like', `a aimé ton avis sur ${comment.album_id.split(' - ')[1]}`);
        }
    };

    const openSocialList = async (type: "followers" | "following") => {
        setSocialModal(type);
        setSocialList([]);
        const targetUser = viewedProfile || profile;
        if (!targetUser) return;
        if (type === 'following') {
            const { data } = await supabase.from('follows').select('following_username').eq('follower_id', targetUser.id);
            if (data) {
                const usernames = data.map(f => f.following_username);
                const { data: profiles } = await supabase.from('profiles').select('*').in('username', usernames);
                setSocialList(profiles || []);
            }
        } else {
            const { data } = await supabase.from('follows').select('follower_id').eq('following_username', targetUser.username);
            if (data) {
                const ids = data.map(f => f.follower_id);
                const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
                setSocialList(profiles || []);
            }
        }
    };

    useEffect(() => {
        if (selectedItem) {
            fetchSupabaseComments(selectedItem);
            const type = getType(selectedItem);
            const artistName = getArtist(selectedItem);
            getDeezerData(`/search/track?q=${artistName}&limit=5`).then(d => setRecommendations(d.data || []));
            if (type === 'album') {
                getDeezerData(`/search?q=${artistName} ${getTitle(selectedItem)}`)
                    .then(d => {
                        if (d.data && d.data[0]) {
                            getDeezerData(`/album/${d.data[0].album.id}/tracks`).then(t => setItemDetails({ tracks: { track: t.data } }));
                        }
                    });
            } else setItemDetails(null);
            const existing = library.find(a => a.album_key === getKey(selectedItem));
            setRating(existing?.rating || 0); setReview(existing?.review || ""); setSelectedGenre(existing?.genre || "Pop");
        }
    }, [selectedItem, library]);

    const generateDna = (albums: any[]) => GENRES_KEYS.map(g => ({ subject: g, A: albums.reduce((acc, a) => (a.genre === g ? acc + 1 : acc), 0) || 1, fullMark: albums.length || 1 }));
    const currentDna = useMemo(() => generateDna(viewedProfile ? viewedRated : myRated), [myRated, viewedRated, viewedProfile]);

    const playPreview = (url: string) => {
        if (!url) return;
        if (playingUri === url) {
            audioRef.current?.pause();
            setPlayingUri(null);
        } else {
            setPlayingUri(url);
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play().catch(e => console.log("Autoplay bloqué sans interaction"));
            }
        }
    };

    const albumStats = useMemo(() => {
        if (communityComments.length === 0) return { avg: "—", distribution: [0, 0, 0, 0, 0] };
        const ratings = communityComments.filter(c => c.rating > 0).map(c => c.rating);
        if (ratings.length === 0) return { avg: "—", distribution: [0, 0, 0, 0, 0] };
        const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
        const counts = [0, 0, 0, 0, 0];
        ratings.forEach(r => { if (r >= 1 && r <= 5) counts[r - 1]++; });
        const maxCount = Math.max(...counts);
        return { avg, distribution: counts.map(c => maxCount > 0 ? (c / maxCount) * 100 : 0) };
    }, [communityComments]);

    const userStats = useMemo(() => {
        const targetLibrary = viewedProfile ? viewedRated : myRated;
        const ratings = targetLibrary.map(item => item.rating);
        if (ratings.length === 0) return { avg: "—", distribution: Array(10).fill(0) };
        const sum = ratings.reduce((a, b) => a + b, 0);
        const avg = (sum / ratings.length).toFixed(1);
        const counts = Array(10).fill(0);
        ratings.forEach(r => { const index = Math.round(r * 2) - 1; if (index >= 0 && index < 10) counts[index]++; });
        const maxCount = Math.max(...counts);
        return { avg, distribution: counts.map(c => maxCount > 0 ? (c / maxCount) * 100 : 0) };
    }, [viewedProfile, viewedRated, myRated]);

    const toggleLang = () => { const newLang = lang === "fr" ? "en" : "fr"; setLang(newLang); localStorage.setItem("mb_lang", newLang); };

    // --- DYNAMIC THEME ---
    const topAlbum = useMemo(() => (viewedProfile ? viewedTop4 : myTop4)[0], [viewedProfile, viewedTop4, myTop4]);

    return (
        <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
            <audio ref={audioRef} onEnded={() => setPlayingUri(null)} />

            {/* CSS INJECTÉ */}
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* DYNAMIC BACKGROUND (Account Tab) */}
            {activeTab === 'account' && topAlbum && (
                <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${getCover(topAlbum)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(100px) saturate(2) brightness(0.6)', opacity: 0.5, zIndex: 0 }} />
            )}

            {/* DIGGER DYNAMIC BACKGROUND */}
            {activeTab === 'digger' && diggerStack[currentDiggerIndex] && (
                <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${getCover(diggerStack[currentDiggerIndex])})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(80px) brightness(0.3)', transition: 'all 0.5s ease', zIndex: 0 }} />
            )}

            {/* HEADER */}
            <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '60px', backgroundColor: 'rgba(10,12,15,0.9)', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <h1 style={{ color: 'white', fontSize: '16px', fontWeight: 'bold', letterSpacing: '4px' }}>MUSICBOX</h1>
                {session && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setShowNotifs(!showNotifs); markNotifsRead(); }} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>
                        🔔 {hasUnread && <span style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', background: 'red', borderRadius: '50%' }}></span>}
                    </motion.button>
                )}
            </header>

            {/* NOTIFICATIONS */}
            <AnimatePresence>
                {showNotifs && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'fixed', top: '60px', right: '10px', width: '250px', background: '#111', border: `1px solid ${COLORS.border}`, borderRadius: '10px', zIndex: 9999, padding: '10px' }}>
                        <h4 style={{ color: 'white', marginBottom: '10px' }}>{t('notifications')}</h4>
                        {notifications.length > 0 ? notifications.map((n, i) => (
                            <div key={i} style={{ fontSize: '12px', padding: '10px', borderBottom: `1px solid ${COLORS.border}`, color: 'white' }}>
                                <b>@{n.from_username}</b> {n.content}
                            </div>
                        )) : <div style={{ fontSize: '12px', color: COLORS.textMuted }}>{t('no_notifs')}</div>}
                    </motion.div>
                )}
            </AnimatePresence>

            {!session && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '80px', height: '80px', background: `linear-gradient(45deg, ${COLORS.accent}, #fb7185)`, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', fontWeight: 'bold', marginBottom: '30px' }}>MB</div>
                    <h1 style={{ color: 'white', marginBottom: '30px' }}>MUSICBOX</h1>
                    <form onSubmit={handleAuth} style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {authMode === 'signup' && <input placeholder="Pseudo" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ padding: '15px', borderRadius: '8px' }} required />}
                        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '15px', borderRadius: '8px' }} required />
                        <input placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '15px', borderRadius: '8px' }} required />
                        <button type="submit" disabled={loading} style={{ padding: '15px', background: COLORS.accent, color: 'white', borderRadius: '8px', border: 'none' }}>{loading ? "..." : (authMode === 'login' ? "Connexion" : "Inscription")}</button>
                    </form>
                    <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} style={{ marginTop: '20px', background: 'none', border: 'none', color: COLORS.accent }}>{authMode === 'login' ? "Créer un compte" : "J'ai déjà un compte"}</button>
                </div>
            )}

            <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 20px 120px', position: 'relative', zIndex: 1 }}>
                <AnimatePresence mode="wait">

                    {/* DISCOVER */}
                    {activeTab === 'discover' && (
                        <motion.div key="discover" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                            <div style={{ marginBottom: '30px', padding: '20px', background: `linear-gradient(45deg, ${COLORS.track}, ${COLORS.accent})`, borderRadius: '20px', color: 'white', boxShadow: `0 10px 30px rgba(59, 130, 246, 0.3)` }}>
                                <h2 style={{ fontSize: '24px', margin: 0, fontWeight: '900' }}>{t('top_hits')}</h2>
                                <p style={{ margin: '5px 0 0', opacity: 0.9 }}>{t('top_desc')}</p>
                            </div>
                            {dailyDrop && (
                                <motion.div whileHover={{ scale: 1.02 }} onClick={() => openItemModal(dailyDrop)} style={{ marginBottom: '30px', position: 'relative', height: '180px', borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${COLORS.border}` }}>
                                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${getCover(dailyDrop)})`, backgroundSize: 'cover', filter: 'blur(20px) brightness(0.5)' }} />
                                    <div style={{ position: 'absolute', inset: 0, padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <img src={getCover(dailyDrop)} style={{ height: '140px', borderRadius: '10px' }} />
                                        <div>
                                            <span style={{ background: COLORS.accent, color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '10px' }}>{t('daily_drop')}</span>
                                            <h2 style={{ color: 'white', fontSize: '20px', margin: '5px 0' }}>{getTitle(dailyDrop)}</h2>
                                            <p style={{ color: 'white', opacity: 0.8 }}>{getArtist(dailyDrop)}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px' }}>
                                {trending.map((a, i) => (
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} onClick={() => openItemModal(a)} style={{ cursor: 'pointer' }}>
                                        <div style={{ position: 'relative' }}>
                                            <img src={getCover(a)} style={{ width: '100%', borderRadius: '12px', marginBottom: '10px' }} />
                                            <span style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '12px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: `1px solid ${COLORS.border}` }}>#{i + 1}</span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{getTitle(a)}</p>
                                        <p style={{ fontSize: '11px', color: COLORS.textMuted, margin: 0 }}>{getArtist(a)}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* DIGGER MODE (SCROLL VERTICAL & AUTO PLAY) */}
                    {activeTab === 'digger' && (
                        <motion.div key="digger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: 'calc(100vh - 140px)', position: 'relative' }}>

                            {/* Start Overlay (Required by Browser for Audio) */}
                            {!diggerStarted && (
                                <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <button onClick={() => { setDiggerStarted(true); if (diggerStack[0]) playPreview(diggerStack[0].preview) }} style={{ padding: '20px 40px', background: COLORS.accent, color: 'white', border: 'none', borderRadius: '30px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        {t('start_digger')}
                                    </button>
                                </div>
                            )}

                            <div
                                className="no-scrollbar"
                                onScroll={handleDiggerScroll}
                                style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory' }}
                            >
                                {diggerStack.map((item, i) => (
                                    <div key={i} className="digger-card" data-preview={item.preview} data-id={item.id} style={{ height: '100%', width: '100%', scrollSnapAlign: 'start', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '100%', maxWidth: '400px', display: 'flex', padding: '20px', alignItems: 'center', gap: '20px' }}>
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <img src={getCover(item)} style={{ width: '100%', borderRadius: '15px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
                                                {/* VISUALIZER OVERLAY */}
                                                {playingUri === item.preview && <Visualizer />}
                                                <h2 style={{ color: 'white', marginTop: '20px', fontSize: '24px' }}>{getTitle(item)}</h2>
                                                <p style={{ color: COLORS.textMuted, fontSize: '16px' }}>{getArtist(item)}</p>
                                            </div>

                                            {/* ACTIONS BARRE LATERALE */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
                                                {/* Play (Indicateur visuel car auto-play) */}
                                                <button onClick={() => playPreview(item.preview)} style={{ width: '50px', height: '50px', borderRadius: '50%', background: COLORS.track, color: 'white', border: 'none', fontSize: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', opacity: playingUri === item.preview ? 1 : 0.5 }}>
                                                    {playingUri === item.preview ? "⏸" : "▶"}
                                                </button>

                                                {/* Watchlist with Visual Feedback (GREEN ANIMATION) */}
                                                <motion.button
                                                    whileTap={{ scale: 0.8 }}
                                                    animate={{
                                                        backgroundColor: watchlistedIds.includes(getKey(item)) ? COLORS.green : 'rgba(255,255,255,0.1)',
                                                        borderColor: watchlistedIds.includes(getKey(item)) ? COLORS.green : COLORS.border,
                                                        scale: watchlistedIds.includes(getKey(item)) ? [1, 1.2, 1] : 1
                                                    }}
                                                    onClick={() => toggleDiggerWatchlist(item)}
                                                    style={{ width: '50px', height: '50px', borderRadius: '50%', color: 'white', border: `1px solid`, fontSize: '20px' }}
                                                >
                                                    🕒
                                                </motion.button>

                                                {/* Rate/Like */}
                                                <button onClick={() => openItemModal(item)} style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: COLORS.red, border: `1px solid ${COLORS.border}`, fontSize: '20px' }}>
                                                    ❤️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isFetchingDigger && <p style={{ textAlign: 'center', padding: '20px', color: COLORS.textMuted }}>{t('loading')}</p>}
                            </div>
                        </motion.div>
                    )}

                    {/* ACTIVITY (RESTORED) */}
                    {activeTab === 'activity' && (
                        <motion.div key="activity" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                            <div style={{ marginBottom: '30px' }}>
                                <h2 style={{ color: 'white', fontSize: '24px', marginBottom: '15px' }}>Social Hub</h2>
                                <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder={t('search_friend')} style={{ width: '100%', padding: '15px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                                {userSearchResults.length > 0 && (
                                    <div style={{ marginTop: '10px', background: COLORS.surface, borderRadius: '12px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                                        {userSearchResults.map(u => (
                                            <div key={u.id} style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}` }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <img src={u.avatar_url} style={{ width: '30px', height: '30px', borderRadius: '50%' }} />
                                                    <b style={{ color: 'white' }} onClick={() => loadUserProfile(u.username)}>@{u.username}</b>
                                                </div>
                                                {u.username !== profile?.username && (
                                                    <button onClick={() => toggleFollow(u.username)} style={{ fontSize: '12px', padding: '5px 15px', borderRadius: '15px', background: myFollows.includes(u.username) ? 'transparent' : 'white', color: myFollows.includes(u.username) ? 'white' : 'black', border: myFollows.includes(u.username) ? `1px solid ${COLORS.border}` : 'none' }}>
                                                        {myFollows.includes(u.username) ? t('following') : t('follow')}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}` }}>
                                <button onClick={() => setSubTabActivity('friends')} style={{ padding: '10px 0', background: 'none', border: 'none', color: subTabActivity === 'friends' ? 'white' : COLORS.textMuted, fontWeight: 'bold', borderBottom: subTabActivity === 'friends' ? `2px solid ${COLORS.accent}` : 'none', cursor: 'pointer' }}>{t('friends')}</button>
                                <button onClick={() => setSubTabActivity('personal')} style={{ padding: '10px 0', background: 'none', border: 'none', color: subTabActivity === 'personal' ? 'white' : COLORS.textMuted, fontWeight: 'bold', borderBottom: subTabActivity === 'personal' ? `2px solid ${COLORS.accent}` : 'none', cursor: 'pointer' }}>{t('me')}</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {subTabActivity === 'friends' ? (
                                    friendsActivity.length > 0 ? friendsActivity.map((a, i) => (
                                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={i} style={{ background: COLORS.surface, padding: '20px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, display: 'flex', gap: '15px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>{a.username[0].toUpperCase()}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                    <b onClick={() => loadUserProfile(a.username)} style={{ color: 'white', cursor: 'pointer', fontSize: '15px' }}>@{a.username}</b>
                                                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: lang === 'fr' ? fr : enUS })}</span>
                                                </div>
                                                <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 10px 0' }}>{lang === 'fr' ? 'a écouté' : 'listened to'} <span style={{ color: 'white', fontWeight: 'bold' }}>{a.album_id.split(' - ')[1]}</span> {a.type === 'track' && '🎵'}</p>
                                                {a.content && <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', borderLeft: `3px solid ${COLORS.accent}`, marginBottom: '10px' }}><p style={{ color: 'white', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>"{a.content}"</p></div>}
                                                <div style={{ fontSize: '14px', color: COLORS.accent }}>{"★".repeat(Math.floor(a.rating))}{a.rating % 1 !== 0 && "½"}</div>
                                            </div>
                                            <img src={a.image || DEFAULT_IMG} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                                        </motion.div>
                                    )) : <p style={{ textAlign: 'center', color: COLORS.textMuted }}>...</p>
                                ) : (
                                    myRated.length > 0 ? myRated.map((a, i) => (
                                        <div key={i} style={{ background: COLORS.surface, padding: '15px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, display: 'flex', gap: '15px', alignItems: 'center' }}>
                                            <img src={a.image} style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
                                            <div>
                                                <b style={{ color: 'white', fontSize: '14px' }}>{a.title}</b>
                                                <span style={{ fontSize: '10px', color: a.type === 'track' ? COLORS.track : COLORS.album, marginLeft: '5px', border: '1px solid', padding: '2px 4px', borderRadius: '4px' }}>{a.type === 'track' ? 'SON' : 'ALBUM'}</span>
                                                <div style={{ color: COLORS.accent, fontSize: '12px' }}>{"★".repeat(Math.floor(a.rating))}{a.rating % 1 !== 0 && "½"}</div>
                                            </div>
                                        </div>
                                    )) : <p style={{ textAlign: 'center', color: COLORS.textMuted }}>Tu n'as encore rien noté.</p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* SEARCH */}
                    {activeTab === 'search' && (
                        <motion.div key="search" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                <button onClick={() => setSearchType('track')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: searchType === 'track' ? COLORS.track : COLORS.surface, color: 'white', fontWeight: 'bold' }}>{t('tracks')}</button>
                                <button onClick={() => setSearchType('album')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: searchType === 'album' ? COLORS.album : COLORS.surface, color: 'white', fontWeight: 'bold' }}>{t('albums')}</button>
                            </div>
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search_placeholder')} style={{ width: '100%', padding: '20px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.border}`, borderRadius: '15px', color: 'white', fontSize: '18px', outline: 'none' }} autoFocus />
                            {query.length < 3 && (
                                <div style={{ marginTop: '30px' }}>
                                    <h4 style={{ color: COLORS.textMuted, marginBottom: '15px' }}>{t('categories')}</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {GENRES_KEYS.map(tag => (
                                            <button key={tag} onClick={() => setQuery(tag)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: 'white', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer' }}>{t(tag)}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '20px', marginTop: '20px' }}>
                                {searchResults.map((a, i) => (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} key={i} onClick={() => openItemModal(a)} style={{ cursor: 'pointer' }}>
                                        <img src={getCover(a)} style={{ width: '100%', borderRadius: '10px' }} />
                                        <p style={{ fontSize: '12px', color: 'white', marginTop: '5px' }}>{getTitle(a)}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ACCOUNT */}
                    {activeTab === 'account' && (viewedProfile || profile) && (
                        <motion.div key="account" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                            {viewedProfile && <button onClick={() => { setViewedProfile(null); setActiveTab("account"); }} style={{ color: COLORS.accent, background: 'none', border: 'none', marginBottom: '20px' }}>← {t('back')}</button>}
                            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 10px' }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                                        <img src={(viewedProfile || profile).avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    {!viewedProfile && <button onClick={() => setShowSettings(true)} style={{ position: 'absolute', top: 0, right: -10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: 'white' }}>⚙️</button>}
                                    {(viewedProfile || profile).anthem_url && (
                                        <button onClick={() => playPreview((viewedProfile || profile).anthem_url)} style={{ position: 'absolute', bottom: -5, right: -5, background: 'white', color: 'black', border: 'none', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', zIndex: 10 }}>
                                            {playingUri === (viewedProfile || profile).anthem_url ? "⏸" : "▶"}
                                        </button>
                                    )}
                                </div>
                                <h2 style={{ color: 'white' }}>@{viewedProfile?.username || profile.username}</h2>
                                {(viewedProfile?.bio || profile.bio) && <p style={{ fontSize: '13px', color: COLORS.textMuted, maxWidth: '300px', margin: '5px auto 0' }}>{(viewedProfile || profile).bio}</p>}
                                {(viewedProfile || profile).anthem_title && <div style={{ fontSize: '12px', color: COLORS.accent, marginTop: '5px' }}>🎵 {(viewedProfile || profile).anthem_title}</div>}

                                {viewedProfile && <div style={{ marginTop: '10px', color: 'white', fontSize: '12px', background: `linear-gradient(90deg, #ec4899, ${COLORS.accent})`, padding: '5px 15px', borderRadius: '20px', display: 'inline-block' }}>{matchScore}% {t('compatible')} 💘</div>}

                                {!viewedProfile && (
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => setShowAnthemSearch(true)} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '10px' }}>{t('choose_anthem')}</button>
                                            <button onClick={toggleLang} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '10px' }}>{lang === 'fr' ? '🇺🇸 English' : '🇫🇷 Français'}</button>
                                        </div>
                                        <button onClick={handleLogout} style={{ fontSize: '11px', color: COLORS.textMuted, background: 'none', border: 'none' }}>{t('logout')}</button>
                                    </div>
                                )}
                                {viewedProfile && <button onClick={() => toggleFollow(viewedProfile.username)} style={{ marginTop: '10px', padding: '8px 20px', borderRadius: '20px', background: myFollows.includes(viewedProfile.username) ? 'transparent' : 'white', color: myFollows.includes(viewedProfile.username) ? 'white' : 'black', border: `1px solid ${myFollows.includes(viewedProfile.username) ? 'white' : 'transparent'}`, fontWeight: 'bold' }}>{myFollows.includes(viewedProfile.username) ? t('following') : t('follow')}</button>}

                                <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '20px' }}>
                                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => openSocialList('following')} style={{ cursor: 'pointer' }}><b style={{ color: 'white', fontSize: '18px' }}>{viewedProfile ? 0 : myFollows.length}</b><br /><span style={{ fontSize: '11px' }}>{t('following_count')}</span></motion.div>
                                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => openSocialList('followers')} style={{ cursor: 'pointer' }}><b style={{ color: 'white', fontSize: '18px' }}>{viewedProfile ? viewedProfile.followers : followersCount}</b><br /><span style={{ fontSize: '11px' }}>{t('followers')}</span></motion.div>
                                    <div><b style={{ color: 'white', fontSize: '18px' }}>{(viewedProfile ? viewedRated : myRated).length}</b><br /><span style={{ fontSize: '11px' }}>{t('items_count')}</span></div>
                                </div>
                            </div>

                            {/* TOP 4 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '30px' }}>
                                {(viewedProfile ? viewedTop4 : myTop4).concat(Array(4).fill(null)).slice(0, 4).map((a, i) => (
                                    <div key={i} style={{ aspectRatio: '1/1', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: `1px dashed ${COLORS.border}`, overflow: 'hidden' }}>
                                        {a && <img src={a.image} onClick={() => openItemModal(a)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />}
                                    </div>
                                ))}
                            </div>

                            {/* STATS */}
                            <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <h4 style={{ fontSize: '10px', color: COLORS.textMuted, letterSpacing: '1px', marginBottom: '15px' }}>{t('user_stats_title')}</h4>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>{userStats.avg}</span>
                                        <br /><span style={{ fontSize: '10px', color: COLORS.textMuted }}>{t('average')}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '40px', gap: '5px' }}>
                                        {userStats.distribution.map((h, i) => (
                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifySelf: 'flex-end' }}>
                                                <motion.div initial={{ height: 0 }} animate={{ height: `${h || 1}%` }} transition={{ delay: i * 0.05 }} style={{ width: '8px', background: COLORS.accent, borderRadius: '2px 2px 0 0', marginTop: 'auto' }}></motion.div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RADAR */}
                            <div style={{ height: '250px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', marginBottom: '30px' }}>
                                <ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentDna}><PolarGrid stroke="rgba(255,255,255,0.1)" /><PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.textMuted, fontSize: 10 }} /><PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} /><Radar name="User" dataKey="A" stroke={COLORS.accent} strokeWidth={3} fill={COLORS.accent} fillOpacity={0.3} /></RadarChart></ResponsiveContainer>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto' }}>
                                <button onClick={() => setProfileTab('rated')} style={{ padding: '10px', background: 'none', border: 'none', color: profileTab === 'rated' ? 'white' : COLORS.textMuted, borderBottom: profileTab === 'rated' ? `2px solid ${COLORS.accent}` : 'none' }}>{t('rated')}</button>
                                <button onClick={() => setProfileTab('journal')} style={{ padding: '10px', background: 'none', border: 'none', color: profileTab === 'journal' ? 'white' : COLORS.textMuted, borderBottom: profileTab === 'journal' ? `2px solid ${COLORS.accent}` : 'none' }}>{t('journal')}</button>
                                <button onClick={() => setProfileTab('lists')} style={{ padding: '10px', background: 'none', border: 'none', color: profileTab === 'lists' ? 'white' : COLORS.textMuted, borderBottom: profileTab === 'lists' ? `2px solid ${COLORS.accent}` : 'none' }}>{t('lists')}</button>
                                {!viewedProfile && <button onClick={() => setProfileTab('watchlist')} style={{ padding: '10px', background: 'none', border: 'none', color: profileTab === 'watchlist' ? 'white' : COLORS.textMuted, borderBottom: profileTab === 'watchlist' ? `2px solid ${COLORS.accent}` : 'none' }}>{t('watchlist')}</button>}
                            </div>

                            {/* TAB CONTENT */}
                            {profileTab === 'rated' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                                    {(viewedProfile ? viewedRated : myRated).map((a, i) => (
                                        <div key={i} onClick={() => openItemModal(a)} style={{ cursor: 'pointer' }}>
                                            <img src={a.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '10px' }} />
                                            <p style={{ fontSize: '11px', color: 'white', marginTop: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* JOURNAL */}
                            {profileTab === 'journal' && (
                                <div>
                                    {(viewedProfile ? viewedRated : myRated).map((a, i) => {
                                        const safeDate = getSafeDate(a.created_at);
                                        return (
                                            <div key={i} onClick={() => openItemModal(a)} style={{ display: 'flex', gap: '15px', padding: '10px', borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer' }}>
                                                <div style={{ minWidth: '50px', fontSize: '12px', color: COLORS.textMuted, textAlign: 'center' }}>
                                                    <b>{format(safeDate, 'dd')}</b><br />{format(safeDate, 'MMM')}
                                                </div>
                                                <img src={a.image || DEFAULT_IMG} style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
                                                <div>
                                                    <b style={{ color: 'white', fontSize: '14px' }}>{a.title}</b>
                                                    <div style={{ color: COLORS.accent, fontSize: '12px' }}>{"★".repeat(Math.floor(a.rating))}{a.rating % 1 !== 0 && "½"}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            {/* WATCHLIST */}
                            {profileTab === 'watchlist' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' }}>
                                    {myWatchlist.map((a, i) => (
                                        <div key={i} onClick={() => openItemModal(a)} style={{ cursor: 'pointer' }}>
                                            <img src={a.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '10px' }} />
                                            <p style={{ fontSize: '11px', color: 'white', marginTop: '5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* LISTS */}
                            {profileTab === 'lists' && (
                                <div>
                                    {openedList ? (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            <button onClick={() => setOpenedList(null)} style={{ color: COLORS.accent, background: 'none', border: 'none', marginBottom: '15px' }}>← {t('back')}</button>
                                            <h3 style={{ color: 'white', marginBottom: '10px' }}>{openedList.title}</h3>
                                            {openedListItems.length > 0 ? openedListItems.map((a, i) => (
                                                <div key={i} onClick={() => openItemModal(a)} style={{ cursor: 'pointer', display: 'flex', gap: '15px', padding: '10px', borderBottom: `1px solid ${COLORS.border}` }}>
                                                    <img src={a.image || DEFAULT_IMG} style={{ width: '50px', height: '50px', borderRadius: '8px' }} />
                                                    <div><b style={{ color: 'white', fontSize: '14px' }}>{a.title}</b><p style={{ fontSize: '12px', color: COLORS.textMuted }}>{a.artist}</p></div>
                                                </div>
                                            )) : <p style={{ color: COLORS.textMuted }}>{t('empty_list')}</p>}
                                        </motion.div>
                                    ) : (
                                        <div>
                                            {!viewedProfile && (
                                                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                                                    <input value={newListTitle} onChange={e => setNewListTitle(e.target.value)} placeholder={t('list_name')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none' }} />
                                                    <button onClick={createList} style={{ padding: '10px', borderRadius: '10px', border: 'none', background: COLORS.accent, color: 'white' }}>{t('create')}</button>
                                                </div>
                                            )}
                                            {(viewedProfile ? viewedLists : myLists).map((l, i) => (
                                                <div key={i} onClick={() => openList(l)} style={{ padding: '20px', background: COLORS.surface, marginBottom: '10px', borderRadius: '10px', cursor: 'pointer' }}><b style={{ color: 'white' }}>{l.title}</b></div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* MODALS */}
            {socialModal && (<div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div style={{ width: '90%', maxWidth: '350px', background: '#111', padding: '20px', borderRadius: '15px', border: `1px solid ${COLORS.border}` }}><h3 style={{ color: 'white', marginBottom: '20px', textTransform: 'capitalize' }}>{socialModal}</h3><div style={{ maxHeight: '300px', overflowY: 'auto' }}>{socialList.length > 0 ? socialList.map(u => (<div key={u.id} onClick={() => loadUserProfile(u.username)} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }}><img src={u.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '50%' }} /><b style={{ color: 'white' }}>@{u.username}</b></div>)) : <p style={{ color: COLORS.textMuted }}>Personne ici...</p>}</div><button onClick={() => setSocialModal(null)} style={{ marginTop: '20px', width: '100%', padding: '10px', background: COLORS.surface, color: 'white', border: 'none', borderRadius: '10px' }}>Fermer</button></div></div>)}
            {showSettings && (<div style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div style={{ width: '90%', maxWidth: '400px', background: '#111', padding: '30px', borderRadius: '20px', border: `1px solid ${COLORS.border}` }}><h2 style={{ color: 'white', marginBottom: '20px' }}>{t('settings')}</h2><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}><img src={tempAvatar} style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '10px', objectFit: 'cover' }} /><input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} /><button onClick={() => fileInputRef.current?.click()} style={{ fontSize: '12px', padding: '5px 15px', background: COLORS.surface, color: 'white', border: `1px solid ${COLORS.border}`, borderRadius: '10px' }}>{t('change_photo')}</button></div><input value={tempPseudo} onChange={e => setTempPseudo(e.target.value)} style={{ width: '100%', padding: '10px', background: 'black', border: `1px solid ${COLORS.border}`, color: 'white', borderRadius: '8px', marginBottom: '15px' }} /><textarea value={tempBio} onChange={e => setTempBio(e.target.value)} placeholder={t('bio_placeholder')} style={{ width: '100%', height: '80px', padding: '10px', background: 'black', border: `1px solid ${COLORS.border}`, color: 'white', borderRadius: '8px', marginBottom: '20px' }} /><div style={{ display: 'flex', gap: '10px' }}><button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: '10px', background: 'none', border: `1px solid ${COLORS.border}`, color: 'white', borderRadius: '10px' }}>Annuler</button><button onClick={saveSettings} style={{ flex: 1, padding: '10px', background: COLORS.accent, border: 'none', color: 'white', borderRadius: '10px', fontWeight: 'bold' }}>{loading ? "..." : t('save')}</button></div></div></div>)}
            {showAnthemSearch && (<div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.9)', padding: '20px' }}><button onClick={() => setShowAnthemSearch(false)} style={{ color: 'white', background: 'none', border: 'none', fontSize: '20px', marginBottom: '20px' }}>✕ Fermer</button><h2 style={{ color: 'white' }}>{t('choose_anthem')}</h2><input value={anthemQuery} onChange={e => setAnthemQuery(e.target.value)} placeholder={t('search_placeholder')} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none' }} autoFocus /><div style={{ marginTop: '20px' }}>{anthemResults.map(t => (<div key={t.id} onClick={() => setAnthem(t)} style={{ display: 'flex', gap: '15px', padding: '10px', borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer' }}><img src={t.album.cover_small} style={{ borderRadius: '5px' }} /><div><div style={{ color: 'white', fontWeight: 'bold' }}>{t.title}</div><div style={{ color: COLORS.textMuted, fontSize: '12px' }}>{t.artist.name}</div></div></div>))}</div></div>)}
            {showListModal && (<div style={{ position: 'fixed', inset: 0, zIndex: 7000, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div style={{ width: '300px', background: '#111', padding: '20px', borderRadius: '15px' }}><h3 style={{ color: 'white', marginBottom: '15px' }}>{t('add_to_list')}</h3>{myLists.map(l => (<button key={l.id} onClick={() => addToList(l.id)} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '10px', border: '1px solid white', background: 'none', color: 'white' }}>{l.title}</button>))}<button onClick={() => setShowListModal(false)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'red', color: 'white' }}>Fermer</button></div></div>)}

            <AnimatePresence>
                {selectedItem && (
                    <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0a0c0f', overflowY: 'auto' }}>
                        <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${getCover(selectedItem)})`, backgroundSize: 'cover', filter: 'blur(50px) brightness(0.2)', zIndex: -1 }} />
                        <audio ref={audioRef} onEnded={() => setPlayingUri(null)} />
                        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                            <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', marginBottom: '20px' }}>✕ Fermer</button>
                            <div style={{ textAlign: 'center' }}>
                                <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} src={getCover(selectedItem)} style={{ width: '200px', borderRadius: '15px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} />
                                {getType(selectedItem) === 'track' && <div style={{ marginTop: '10px', color: COLORS.track, fontWeight: 'bold', border: '1px solid', display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>SON</div>}
                                <h2 style={{ color: 'white', margin: '20px 0 5px' }}>{getTitle(selectedItem)}</h2>
                                <p style={{ color: COLORS.accent }}>{getArtist(selectedItem)}</p>
                                {getType(selectedItem) === 'track' && selectedItem.preview && (<motion.button whileTap={{ scale: 0.95 }} onClick={() => playPreview(selectedItem.preview)} style={{ background: COLORS.track, border: 'none', color: 'white', padding: '10px 30px', borderRadius: '30px', fontWeight: 'bold', margin: '15px 0' }}>{playingUri === selectedItem.preview ? t('pause') : t('listen')}</motion.button>)}
                                <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                                    <div style={{ textAlign: 'center' }}><span style={{ fontSize: '30px', fontWeight: 'bold', color: 'white' }}>{albumStats.avg}</span><br /><span style={{ fontSize: '10px', color: COLORS.textMuted }}>{t('average')}</span></div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '40px', gap: '5px' }}>{albumStats.distribution.map((h, i) => (<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifySelf: 'flex-end' }}><div style={{ width: '10px', height: `${h || 1}%`, background: COLORS.accent, borderRadius: '2px 2px 0 0', marginTop: 'auto' }}></div></div>))}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
                                    <button onClick={(e) => toggleWatchlist(e, selectedItem)} style={{ padding: '8px 16px', borderRadius: '20px', background: myWatchlist.find(a => a.album_key === getKey(selectedItem)) ? COLORS.accent : 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>{t('watchlist')}</button>
                                    <button onClick={() => toggleTopFour(selectedItem)} style={{ padding: '8px 16px', borderRadius: '20px', background: myTop4.find(a => a.album_key === getKey(selectedItem)) ? COLORS.accent : 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>Top 4</button>
                                    <button onClick={() => setShowListModal(true)} style={{ padding: '8px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>+ List</button>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '15px' }}>{[1, 2, 3, 4, 5].map((star) => (<div key={star} style={{ position: 'relative', width: '30px', height: '30px', cursor: 'pointer' }}><div onClick={() => setRating(star - 0.5)} style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 10 }} /><div onClick={() => setRating(star)} style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 10 }} /><span style={{ fontSize: '30px', color: rating >= star ? COLORS.accent : (rating === star - 0.5 ? COLORS.accent : 'rgba(255,255,255,0.1)'), opacity: rating === star - 0.5 ? 0.6 : 1 }}>★</span></div>))}</div>
                                <div style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', fontSize: '18px', color: COLORS.accent }}>{rating > 0 ? rating : "Note"}</div>
                                <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', marginBottom: '10px', background: 'black', color: 'white' }}>{GENRES_KEYS.map(g => <option key={g} value={g}>{t(g)}</option>)}</select>
                                <textarea value={review} onChange={e => setReview(e.target.value)} placeholder={t('your_review')} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'black', color: 'white', border: 'none' }} />
                                <motion.button whileTap={{ scale: 0.95 }} onClick={handleRate} style={{ width: '100%', padding: '15px', background: COLORS.accent, border: 'none', borderRadius: '10px', color: 'white', marginTop: '10px', fontWeight: 'bold' }}>{t('publish')}</motion.button>
                            </div>
                            {getType(selectedItem) === 'album' && itemDetails?.tracks?.track && (<div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '20px', marginBottom: '20px' }}>{itemDetails.tracks.track.map((track: any, i: number) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: '13px' }}><span>{i + 1}. {track.title}</span><button onClick={() => playPreview(track.preview)} style={{ background: 'none', border: 'none', color: playingUri === track.preview ? COLORS.accent : 'white' }}>{playingUri === track.preview ? t('pause') : t('listen')}</button></div>))}</div>)}
                            <div>{communityComments.filter(c => !c.parent_id).map((c, i) => (
                                <div key={i} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: `1px solid ${COLORS.border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><b onClick={() => { setSelectedItem(null); loadUserProfile(c.username); }} style={{ color: COLORS.accent }}>@{c.username}</b><span style={{ fontSize: '10px', color: COLORS.textMuted }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: lang === 'fr' ? fr : enUS })}</span></div>
                                    <p style={{ color: 'white', margin: '5px 0' }}>{c.content}</p>
                                    <div style={{ display: 'flex', gap: '10px' }}><motion.button whileTap={{ scale: 1.2 }} onClick={() => handleLike(c.id, c.likes)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '12px' }}>❤ {c.likes || 0}</motion.button><button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '12px' }}>{t('reply')}</button></div>
                                    {replyTo === c.id && <div style={{ marginTop: '10px' }}><input value={replyText} onChange={e => setReplyText(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: 'none', background: 'black', color: 'white' }} autoFocus /><button onClick={() => saveReply(c)} style={{ marginTop: '5px', padding: '5px 10px', background: COLORS.accent, border: 'none', borderRadius: '5px', color: 'white' }}>{t('send')}</button></div>}
                                    {communityComments.filter(r => r.parent_id === c.id).map((r, j) => (<div key={j} style={{ marginLeft: '20px', marginTop: '10px', paddingLeft: '10px', borderLeft: `2px solid ${COLORS.border}` }}><b style={{ color: COLORS.textMuted, fontSize: '12px' }}>@{r.username}</b><p style={{ color: 'white', fontSize: '13px', margin: '2px 0' }}>{r.content}</p></div>))}
                                </div>
                            ))}</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NAV BAR */}
            <nav style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', height: '70px', background: 'rgba(20,20,20,0.95)', border: `1px solid ${COLORS.border}`, borderRadius: '35px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveTab('discover')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'discover' ? 1 : 0.5 }}>🏠</motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveTab('search')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'search' ? 1 : 0.5 }}>🔍</motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveTab('digger')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'digger' ? 1 : 0.5 }}>🔥</motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveTab('activity')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'activity' ? 1 : 0.5 }}>⚡</motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveTab('account')} style={{ fontSize: '24px', background: 'none', border: 'none', opacity: activeTab === 'account' ? 1 : 0.5 }}>👤</motion.button>
            </nav>
        </div>
    );
}