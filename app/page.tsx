"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = {
  bg: '#0a0c0f',
  surface: 'rgba(255, 255, 255, 0.03)',
  surfaceLight: 'rgba(255, 255, 255, 0.08)',
  accent: '#f97316',
  textMain: '#ffffff',
  textMuted: '#94a3b8',
  border: 'rgba(255, 255, 255, 0.1)'
};

const DEFAULT_IMG = "https://via.placeholder.com/300/1b2228/f97316?text=No+Cover";

export default function Home() {
  const [activeTab, setActiveTab] = useState("discover");
  const [ratedAlbums, setRatedAlbums] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [topFour, setTopFour] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumDetails, setAlbumDetails] = useState(null);
  const [communityComments, setCommunityComments] = useState([]);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [username, setUsername] = useState("Anonyme");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [likedComments, setLikedComments] = useState([]);
  const [sortBy, setSortBy] = useState("likes");
  
  const audioRef = useRef(null);
  const [playingUri, setPlayingUri] = useState(null);

  // --- PERSISTANCE ---
  useEffect(() => {
    const savedData = localStorage.getItem("musicbox-data");
    const savedWatch = localStorage.getItem("musicbox-watchlist");
    const savedUser = localStorage.getItem("musicbox-user");
    const savedTop = localStorage.getItem("musicbox-top4");
    const savedLikes = localStorage.getItem("musicbox-likes");

    if (savedData) setRatedAlbums(JSON.parse(savedData).map(a => ({...a, timestamp: a.timestamp || new Date().toISOString()})));
    if (savedWatch) setWatchlist(JSON.parse(savedWatch));
    if (savedUser) setUsername(savedUser);
    if (savedTop) setTopFour(JSON.parse(savedTop));
    if (savedLikes) setLikedComments(JSON.parse(savedLikes));
    
    fetch(`/api/search`).then(res => res.json()).then(data => setTrending(data.slice(0, 60)));
  }, []);

  useEffect(() => {
    localStorage.setItem("musicbox-user", username);
    localStorage.setItem("musicbox-watchlist", JSON.stringify(watchlist));
    localStorage.setItem("musicbox-data", JSON.stringify(ratedAlbums));
    localStorage.setItem("musicbox-top4", JSON.stringify(topFour));
    localStorage.setItem("musicbox-likes", JSON.stringify(likedComments));
  }, [username, watchlist, ratedAlbums, topFour, likedComments]);

  // --- AUTOCOMPLETE ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) fetch(`/api/search?query=${encodeURIComponent(query)}`).then(r => r.json()).then(setSearchResults);
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // --- INFOS ALBUM + DEEZER ---
  useEffect(() => {
    if (selectedAlbum) {
      fetch(`/api/search?artist=${encodeURIComponent(selectedAlbum.artist)}&album=${encodeURIComponent(selectedAlbum.title)}`)
        .then(res => res.json())
        .then(async (data) => {
          try {
            const dzRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(selectedAlbum.artist + " " + selectedAlbum.title)}`);
            const dzData = await dzRes.json();
            
            const rawTracks = data.tracks?.track;
            const trackArray = Array.isArray(rawTracks) ? rawTracks : (rawTracks ? [rawTracks] : []);
            
            const tracks = trackArray.map(t => {
              const match = dzData.data?.find(d => d.title.toLowerCase().includes(t.name.toLowerCase()));
              return { ...t, preview: match?.preview };
            });
            setAlbumDetails({ ...data, tracks: { track: tracks } });
          } catch (e) { setAlbumDetails(data); }
        });
      fetchSupabaseComments(selectedAlbum);
      const existing = ratedAlbums.find(a => a.title === selectedAlbum.title);
      setRating(existing ? existing.userRating : 0);
      setReview(existing ? existing.userReview : "");
    }
  }, [selectedAlbum, sortBy]);

  const fetchSupabaseComments = async (album) => {
    const { data } = await supabase.from('comments').select('*').eq('album_id', `${album.artist} - ${album.title}`).order(sortBy === 'likes' ? 'likes' : 'created_at', { ascending: false });
    if (data) setCommunityComments(data);
  };

  // --- ACTIONS ---
  const saveRating = async () => {
    if (rating === 0) return alert("Note obligatoire !");
    const albumData = { ...selectedAlbum, userRating: rating, userReview: review, timestamp: new Date().toISOString() };
    setRatedAlbums([albumData, ...ratedAlbums.filter(a => a.title !== selectedAlbum.title)]);
    setWatchlist(watchlist.filter(a => a.title !== selectedAlbum.title));
    await supabase.from('comments').insert([{ album_id: `${selectedAlbum.artist} - ${selectedAlbum.title}`, username, content: review, rating, image: selectedAlbum.image || DEFAULT_IMG, likes: 0 }]);
    fetchSupabaseComments(selectedAlbum);
    setReview("");
  };

  const handleLike = async (id, currentLikes) => {
    if (likedComments.includes(id)) return;
    const { error } = await supabase.from('comments').update({ likes: (currentLikes || 0) + 1 }).eq('id', id);
    if (!error) {
      setCommunityComments(communityComments.map(c => c.id === id ? { ...c, likes: (c.likes || 0) + 1 } : c));
      setLikedComments([...likedComments, id]);
    }
  };

  const saveReply = async (parentComment) => {
    if (!replyText.trim()) return;
    await supabase.from('comments').insert([{ 
      album_id: `${selectedAlbum.artist} - ${selectedAlbum.title}`, 
      username, content: replyText, rating: 0, 
      parent_id: parentComment.id, image: selectedAlbum.image || DEFAULT_IMG, likes: 0
    }]);
    setReplyTo(null); setReplyText(""); fetchSupabaseComments(selectedAlbum);
  };

  const toggleWatchlist = (e, album) => {
    e.stopPropagation();
    if (watchlist.find(a => a.title === album.title)) setWatchlist(watchlist.filter(a => a.title !== album.title));
    else setWatchlist([...watchlist, album]);
  };

  const toggleTopFour = (a) => {
    if (topFour.find(x => x.title === a.title)) setTopFour(topFour.filter(x => x.title !== a.title));
    else if (topFour.length < 4) setTopFour([...topFour, a]);
  };

  const playPreview = (url) => {
    if (playingUri === url) { audioRef.current.pause(); setPlayingUri(null); }
    else { setPlayingUri(url); audioRef.current.src = url; audioRef.current.play(); }
  };

  const avgRating = ratedAlbums.length > 0 ? (ratedAlbums.reduce((acc, curr) => acc + curr.userRating, 0) / ratedAlbums.length).toFixed(1) : "0.0";

  // --- RENDER DÉTAIL ---
  if (selectedAlbum) {
    const isTop = topFour.some(a => a.title === selectedAlbum.title);
    const inWatch = watchlist.some(a => a.title === selectedAlbum.title);
    const safeTracks = albumDetails?.tracks?.track || [];
    
    return (
      <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', color: 'white', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${selectedAlbum.image || DEFAULT_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(100px) brightness(0.2)', opacity: 0.7, zIndex: 0 }} />
        <audio ref={audioRef} onEnded={() => setPlayingUri(null)} />
        
        <header style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(30px)', backgroundColor: 'rgba(10,12,15,0.5)', borderBottom: `1px solid ${COLORS.border}` }}>
          <button onClick={() => {setSelectedAlbum(null); setPlayingUri(null);}} style={{ background: 'none', border: 'none', color: COLORS.accent, cursor: 'pointer', fontWeight: 'bold' }}>← RETOUR</button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={(e) => toggleWatchlist(e, selectedAlbum)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: inWatch ? COLORS.accent : 'white', padding: '10px 18px', borderRadius: '25px', fontSize: '12px', cursor: 'pointer', transition: '0.3s' }}>
              {inWatch ? "✓ WATCHLIST" : "🕒 + LISTE"}
            </button>
            <button onClick={() => toggleTopFour(selectedAlbum)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: isTop ? COLORS.accent : 'white', padding: '10px 18px', borderRadius: '25px', fontSize: '12px', cursor: 'pointer', transition: '0.3s' }}>
              {isTop ? "🏆 TOP 4" : "🏅 ÉPINGLER"}
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 20px 150px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '50px', marginBottom: '60px' }}>
            <img src={selectedAlbum.image || DEFAULT_IMG} style={{ width: '320px', height: '320px', borderRadius: '16px', boxShadow: '0 40px 80px rgba(0,0,0,0.8)' }} />
            <div style={{ flex: 1, minWidth: '320px' }}>
              <h1 style={{ fontSize: '48px', margin: 0, fontWeight: '900' }}>{selectedAlbum.title}</h1>
              <p style={{ fontSize: '26px', color: COLORS.accent }}>{selectedAlbum.artist}</p>
              
              <div style={{ display: 'flex', gap: '12px', margin: '25px 0' }}>
                <a href={`https://open.spotify.com/search/${encodeURIComponent(selectedAlbum.artist + " " + selectedAlbum.title)}`} target="_blank" style={{ background: '#1DB954', padding: '10px 20px', borderRadius: '25px', fontSize: '12px', color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>Spotify</a>
                <a href={`https://www.deezer.com/search/${encodeURIComponent(selectedAlbum.artist + " " + selectedAlbum.title)}`} target="_blank" style={{ background: '#ef5466', padding: '10px 20px', borderRadius: '25px', fontSize: '12px', color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>Deezer</a>
              </div>

              <div style={{ background: COLORS.surface, backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '20px', border: `1px solid ${COLORS.border}` }}>
                <h3 style={{ fontSize: '10px', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>Tracklist & Previews</h3>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {(Array.isArray(safeTracks) ? safeTracks : []).length > 0 ? (
                    (Array.isArray(safeTracks) ? safeTracks : []).map((t, i) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                        <span><span style={{ color: COLORS.textMuted, width: '25px', display: 'inline-block' }}>{i+1}</span> {t.name}</span>
                        <div style={{ display: 'flex', gap: '20px' }}>
                          {t.preview && <button onClick={() => playPreview(t.preview)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: playingUri === t.preview ? COLORS.accent : 'white' }}>{playingUri === t.preview ? "⏸" : "▶"}</button>}
                        </div>
                      </div>
                    ))
                  ) : <p style={{fontSize: '12px', color: COLORS.textMuted}}>Aucune piste disponible.</p>}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '50px' }}>
            <section>
               <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: COLORS.textMuted, marginBottom: '20px' }}>Ton Avis</h3>
               <div style={{ display: 'flex', gap: '8px', marginBottom: '25px' }}>
                {[1,2,3,4,5].map(s => <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', fontSize: '36px', color: rating >= s ? COLORS.accent : 'rgba(255,255,255,0.05)', cursor: 'pointer' }}>★</button>)}
               </div>
               <textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Écris ton avis..." style={{ width: '100%', height: '140px', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '16px', color: 'white', padding: '20px', outline: 'none' }} />
               <button onClick={saveRating} style={{ width: '100%', background: COLORS.accent, border: 'none', padding: '18px', borderRadius: '16px', marginTop: '15px', fontWeight: '900', cursor: 'pointer' }}>PUBLIER</button>
            </section>

            <section>
               <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: COLORS.textMuted, marginBottom: '20px' }}>Débats</h3>
               <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                 {communityComments.filter(c => !c.parent_id).map((c, i) => (
                   <div key={i} style={{ background: COLORS.surface, padding: '20px', borderRadius: '20px', marginBottom: '18px', border: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <b style={{ color: COLORS.accent }}>@{c.username}</b>
                        <button onClick={() => handleLike(c.id, c.likes)} style={{ background: likedComments.includes(c.id) ? COLORS.accent : 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '11px' }}>❤ {c.likes || 0}</button>
                      </div>
                      <p style={{ fontSize: '15px', margin: '12px 0' }}>{c.content}</p>
                      <button onClick={() => setReplyTo(c.id)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '11px', cursor: 'pointer' }}>💬 RÉPONDRE</button>
                      {communityComments.filter(r => r.parent_id === c.id).map((r, j) => (
                        <div key={j} style={{ marginLeft: '20px', marginTop: '12px', padding: '10px', borderLeft: `2px solid ${COLORS.accent}44`, background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          <b style={{ color: COLORS.textMuted, fontSize: '12px' }}>@{r.username}</b>: {r.content}
                        </div>
                      ))}
                      {replyTo === c.id && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                          <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Répondre..." style={{ flex: 1, background: '#000', border: '1px solid #333', color: 'white', padding: '10px', borderRadius: '8px' }} />
                          <button onClick={() => saveReply(c)} style={{ background: COLORS.accent, border: 'none', color: 'white', padding: '10px', borderRadius: '8px' }}>OK</button>
                        </div>
                      )}
                   </div>
                 ))}
               </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', color: COLORS.textMuted, fontFamily: 'Inter, sans-serif' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '70px', backgroundColor: 'rgba(10,12,15,0.8)', backdropFilter: 'blur(30px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, borderBottom: `1px solid ${COLORS.border}` }}>
        <h1 style={{ color: 'white', fontSize: '14px', fontWeight: '900', letterSpacing: '8px' }}>MUSICBOX</h1>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '110px 20px 140px' }}>
        {activeTab === "discover" && (
          <div>
            <h2 style={{ color: 'white', fontSize: '32px', fontWeight: '900', marginBottom: '40px' }}>Populaire</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '25px' }}>
              {trending.map((album, i) => {
                const isAlreadyInWatch = watchlist.some(w => w.title === album.title);
                return (
                  <div key={i} style={{ position: 'relative', cursor: 'pointer' }}>
                    <img src={album.image || DEFAULT_IMG} onClick={() => setSelectedAlbum(album)} style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px', boxShadow: '0 15px 30px rgba(0,0,0,0.4)' }} />
                    <button 
                      onClick={(e) => toggleWatchlist(e, album)} 
                      style={{ 
                        position: 'absolute', top: '10px', right: '10px', 
                        background: isAlreadyInWatch ? COLORS.accent : 'rgba(0,0,0,0.6)', 
                        backdropFilter: 'blur(5px)', border: 'none', color: 'white', 
                        borderRadius: '50%', width: '32px', height: '32px', fontSize: '14px',
                        boxShadow: isAlreadyInWatch ? `0 0 15px ${COLORS.accent}66` : 'none',
                        transition: '0.3s', cursor: 'pointer'
                      }}
                    >
                      {isAlreadyInWatch ? "✓" : "🕒"}
                    </button>
                    <p style={{ color: 'white', fontSize: '13px', marginTop: '12px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(activeTab === "account" || activeTab === "watchlist") && (
          <section>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50px', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', margin: '0 auto 20px' }}>👤</div>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '36px', fontWeight: '900', textAlign: 'center', outline: 'none', width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '15px' }}>
                <p><b style={{ color: 'white', fontSize: '18px' }}>{ratedAlbums.length}</b> Albums</p>
                <p><b style={{ color: 'white', fontSize: '18px' }}>{avgRating}</b> Moyenne</p>
              </div>
            </div>

            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '2px', textAlign: 'center' }}>Carré d'As</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '50px' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ aspectRatio: '1/1', backgroundColor: COLORS.surface, borderRadius: '12px', border: `1px dashed ${COLORS.border}`, overflow: 'hidden' }}>
                  {topFour[i] && <img src={topFour[i].image || DEFAULT_IMG} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setSelectedAlbum(topFour[i])} />}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '30px', marginBottom: '40px', justifyContent: 'center' }}>
              <button onClick={() => setActiveTab("account")} style={{ background: 'none', border: 'none', color: activeTab === 'account' ? 'white' : COLORS.textMuted, fontWeight: '900', cursor: 'pointer' }}>COLLECTION</button>
              <button onClick={() => setActiveTab("watchlist")} style={{ background: 'none', border: 'none', color: activeTab === 'watchlist' ? 'white' : COLORS.textMuted, fontWeight: '900', cursor: 'pointer' }}>🕒 WATCHLIST ({watchlist.length})</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '15px' }}>
              {activeTab === "account" 
                ? ratedAlbums.map((a, i) => <img key={i} src={a.image || DEFAULT_IMG} onClick={() => setSelectedAlbum(a)} style={{ width: '100%', borderRadius: '10px', cursor: 'pointer' }} />)
                : watchlist.map((a, i) => <img key={i} src={a.image || DEFAULT_IMG} onClick={() => setSelectedAlbum(a)} style={{ width: '100%', borderRadius: '10px', cursor: 'pointer' }} />)
              }
            </div>
          </section>
        )}

        {activeTab === "search" && (
           <div>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Artistes, albums..." style={{ width: '100%', background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: '25px', borderRadius: '20px', color: 'white', fontSize: '20px', outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '25px', marginTop: '40px' }}>
              {searchResults.map((album, i) => (
                <div key={i} onClick={() => setSelectedAlbum(album)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <img src={album.image || DEFAULT_IMG} style={{ width: '100%', borderRadius: '12px' }} />
                  <p style={{ color: 'white', fontSize: '13px', marginTop: '12px', fontWeight: 'bold' }}>{album.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h2 style={{ color: 'white', fontSize: '32px', fontWeight: '900', marginBottom: '40px' }}>Journal</h2>
            {ratedAlbums.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: '25px', padding: '20px', backgroundColor: COLORS.surface, borderRadius: '20px', marginBottom: '15px', border: `1px solid ${COLORS.border}` }}>
                <div style={{ textAlign: 'center', minWidth: '55px', borderRight: `2px solid ${COLORS.border}`, paddingRight: '20px' }}>
                   <span style={{ fontSize: '24px', fontWeight: '900', color: 'white', display: 'block' }}>{format(new Date(log.timestamp), 'dd')}</span>
                   <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>{format(new Date(log.timestamp), 'MMM', {locale: fr})}</span>
                </div>
                <img src={log.image || DEFAULT_IMG} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                <div>
                  <p style={{ color: 'white', fontWeight: '800', margin: 0, fontSize: '16px' }}>{log.title}</p>
                  <p style={{ color: COLORS.accent, margin: '5px 0' }}>{"★".repeat(log.userRating)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', height: '75px', backgroundColor: 'rgba(27, 34, 40, 0.7)', backdropFilter: 'blur(40px)', borderRadius: '40px', border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '92%', maxWidth: '420px', zIndex: 1000, boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
        <button onClick={() => setActiveTab("discover")} style={{ background: 'none', border: 'none', color: activeTab === 'discover' ? COLORS.accent : 'white', fontSize: '26px', cursor: 'pointer' }}>🏠</button>
        <button onClick={() => setActiveTab("search")} style={{ background: 'none', border: 'none', color: activeTab === 'search' ? COLORS.accent : 'white', fontSize: '26px', cursor: 'pointer' }}>🔍</button>
        <button onClick={() => setActiveTab("activity")} style={{ background: 'none', border: 'none', color: activeTab === 'activity' ? COLORS.accent : 'white', fontSize: '26px', cursor: 'pointer' }}>⚡</button>
        <button onClick={() => setActiveTab("account")} style={{ background: 'none', border: 'none', color: (activeTab === 'account' || activeTab === 'watchlist') ? COLORS.accent : 'white', fontSize: '26px', cursor: 'pointer' }}>👤</button>
      </nav>
    </div>
  );
}