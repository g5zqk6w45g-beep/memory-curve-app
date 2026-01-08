"use client";

import Streak from "@/components/Streak";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// --- TYPES ---
type Flashcard = {
  id: number;
  question: string;
  answer: string;
};

type Topic = {
  id: number;
  title: string;
  stage: number;
  next_review: string;
  course_link?: string;
  exercise_link?: string;
  subject?: string;
  is_active?: boolean;
  flashcards?: Flashcard[];
};

const SUBJECTS = ["Maths", "Méca", "Élec", "Physique", "CGE", "MHO", "Anglais", "Autre"];

// --- HOOK LOGIQUE (Sépare la DB de l'affichage) ---
function useHomeLogic() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      // On récupère uniquement les sujets ACTIFS
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .eq("is_active", true);

      if (!error && data) setTopics(data);
      setLoading(false);
    };
    init();
  }, [router]);

  const addTopic = async (title: string, subject: string, courseLink: string, exoLink: string) => {
    if (!title.trim() || !user) return;
    
    // Ajouté pour demain par défaut
    const date = new Date();
    date.setDate(date.getDate() + 1);

    const newTopic = {
      user_id: user.id,
      title,
      stage: 0,
      next_review: date.toISOString().split("T")[0],
      course_link: courseLink,
      exercise_link: exoLink,
      subject,
      is_active: true,
      flashcards: []
    };

    const { data, error } = await supabase.from("topics").insert([newTopic]).select();
    if (!error && data) setTopics([data[0], ...topics]);
  };

  const reviewTopic = async (id: number, difficulty: 'easy' | 'hard') => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;

    let daysToAdd = 1;
    let newStage = topic.stage;

    if (difficulty === 'hard') {
       daysToAdd = 1;
       newStage = 0;
    } else {
       const intervals = [2, 7, 14, 30];
       daysToAdd = topic.stage < intervals.length ? intervals[topic.stage] : 60;
       newStage = topic.stage + 1;
    }

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    const nextReviewStr = newDate.toISOString().split("T")[0];

    // Mise à jour optimiste
    setTopics(prev => prev.map(t => t.id === id ? { ...t, stage: newStage, next_review: nextReviewStr } : t));
    
    // Mise à jour DB
    await supabase.from("topics").update({ stage: newStage, next_review: nextReviewStr }).eq("id", id);
  };

  return { topics, loading, user, addTopic, reviewTopic };
}

// --- COMPOSANT ISOLÉ : SESSION D'ÉTUDE (Évite les lags du timer) ---
function StudySessionModal({ topic, onClose, onReview }: { topic: Topic, onClose: () => void, onReview: (id: number, diff: 'easy' | 'hard') => void }) {
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [viewMode, setViewMode] = useState<'docs' | 'cards'>('docs');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const nextCard = () => {
    if (!topic.flashcards) return;
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentCardIndex(prev => (prev < (topic.flashcards?.length || 0) - 1 ? prev + 1 : 0));
    }, 200);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Header Session */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold truncate max-w-[150px] md:max-w-xs">{topic.title}</h2>
            <div className="flex bg-gray-200 p-1 rounded-lg gap-1">
              <button onClick={() => setViewMode('docs')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'docs' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}>📄 Docs</button>
              {topic.flashcards && topic.flashcards.length > 0 && (
                <button onClick={() => setViewMode('cards')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>🃏 Cartes</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border shadow-sm">
            <span className={`font-mono text-2xl font-bold ${timeLeft < 60 ? 'text-red-500' : ''}`}>{formatTime(timeLeft)}</span>
            <button onClick={() => setIsTimerActive(!isTimerActive)}>{isTimerActive ? '⏸' : '▶'}</button>
          </div>
          <button onClick={onClose} className="font-bold text-xl px-2 hover:text-red-500">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative">
          {viewMode === 'docs' && (
            <div className="absolute inset-0 flex flex-col md:flex-row divide-x">
              <div className="flex-1 p-4 overflow-y-auto">
                <h3 className="text-blue-600 font-bold mb-4">📖 Cours</h3>
                {topic.course_link ? (
                    <>
                        <iframe src={topic.course_link.replace('/view', '/preview')} className="w-full h-64 md:h-full border rounded" />
                        <a href={topic.course_link} target="_blank" className="block text-center mt-2 text-blue-500 underline text-sm">Ouvrir lien</a>
                    </>
                ) : <p className="italic text-gray-400">Rien</p>}
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                  <h3 className="text-green-600 font-bold mb-4">✏️ Exos</h3>
                  {topic.exercise_link ? <a href={topic.exercise_link} target="_blank" className="block p-4 bg-green-50 border border-green-200 rounded text-green-700 font-bold text-center hover:bg-green-100">Voir Exos</a> : <p className="italic text-gray-400">Rien</p>}
              </div>
            </div>
          )}

          {viewMode === 'cards' && topic.flashcards && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gray-100">
              <div onClick={() => setIsFlipped(!isFlipped)} className="w-full max-w-2xl aspect-video bg-white rounded-3xl shadow-xl flex items-center justify-center cursor-pointer hover:shadow-2xl transition transform duration-500 relative perspective-1000">
                  <div className="text-center p-8 select-none">
                     <p className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-4">{isFlipped ? "Verso (Réponse)" : "Recto (Question)"}</p>
                     <h3 className={`text-2xl md:text-4xl font-bold transition-colors ${isFlipped ? 'text-indigo-600' : 'text-gray-800'}`}>{isFlipped ? topic.flashcards[currentCardIndex].answer : topic.flashcards[currentCardIndex].question}</h3>
                     <p className="mt-8 text-gray-400 text-sm animate-pulse">(Clique pour retourner)</p>
                  </div>
              </div>
              <div className="mt-8 flex items-center gap-6">
                <span className="font-mono text-gray-500">Carte {currentCardIndex + 1} / {topic.flashcards.length}</span>
                <button onClick={nextCard} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition shadow-lg active:scale-95">Suivante ➔</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t flex justify-center gap-4 bg-white">
           <button onClick={() => { onReview(topic.id, 'hard'); onClose(); }} className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition">😰 Dur</button>
           <button onClick={() => { onReview(topic.id, 'easy'); onClose(); }} className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition shadow-lg">✅ Fait</button>
        </div>
      </div>
    </div>
  );
}

// --- COMPOSANT PAGE D'ACCUEIL ---
export default function Home() {
  const { topics, loading, addTopic, reviewTopic } = useHomeLogic();
  const router = useRouter();

  // États locaux UI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null);

  // Formulaire d'ajout
  const [inputVal, setInputVal] = useState("");
  const [courseLink, setCourseLink] = useState("");
  const [exoLink, setExoLink] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Maths");

  const handleAdd = async () => {
      await addTopic(inputVal, selectedSubject, courseLink, exoLink);
      setInputVal(""); setCourseLink(""); setExoLink("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Groupement par date pour la sidebar
  const groupedTopics = topics.reduce((acc, t) => {
    if (!acc[t.next_review]) acc[t.next_review] = [];
    acc[t.next_review].push(t);
    return acc;
  }, {} as { [key: string]: Topic[] });
  const sortedDates = Object.keys(groupedTopics).sort();

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-indigo-600 animate-pulse">Chargement de ton espace...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row relative">
      
      {/* 1. HEADER MOBILE */}
      <div className="md:hidden bg-white p-4 border-b flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-indigo-600">🧠 Memory</h1>
            <Streak />
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 border rounded-lg hover:bg-gray-100">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* 2. OVERLAY */}
      {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
      )}

      {/* 3. SIDEBAR (Agenda) */}
      <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 p-6 flex flex-col h-screen transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0 md:sticky md:top-0 md:h-screen md:block
      `}>
        <div className="flex justify-between items-center mb-6">
            <div className="hidden md:block">
                <h1 className="text-2xl font-extrabold text-indigo-600 mb-2">🧠 Memory</h1>
                <Streak />
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <nav className="space-y-2 mb-6 border-b border-gray-100 pb-6">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition">🏠 Révisions</Link>
          <Link href="/exams" onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🎓 Examens</Link>
          <Link href="/library" onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">📚 Bibliothèque</Link>
        </nav>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Planning Révisions</h3>
          {sortedDates.map(date => {
            const isToday = date === new Date().toISOString().split("T")[0];
            const isLate = date < new Date().toISOString().split("T")[0];
            return (
                <div key={date} className={isToday ? 'bg-indigo-50 -mx-3 px-3 py-3 rounded-xl border border-indigo-100' : ''}>
                  <h3 className={`font-bold capitalize mb-2 text-sm ${isLate ? 'text-red-500' : 'text-gray-700'}`}>
                    {new Date(date).toLocaleDateString("fr-FR", {weekday:'short', day:'numeric'})} {isLate && "(Retard)"} {isToday && "(Aujourd'hui)"}
                  </h3>
                  <ul className="space-y-1 pl-3 border-l-2 border-gray-200">
                    {groupedTopics[date].map(t => (
                      <li key={t.id} onClick={() => { setStudyingTopic(t); setIsMobileMenuOpen(false); }} className="cursor-pointer text-sm text-gray-500 hover:text-indigo-600 truncate transition">
                        {t.title}
                      </li>
                    ))}
                  </ul>
                </div>
            );
          })}
          {sortedDates.length === 0 && <p className="text-gray-400 text-sm italic text-center mt-10">Tout est à jour ! 🎉</p>}
        </div>
        
        <div className="mt-4 pt-4 border-t">
           <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 text-xs py-3 rounded-xl font-bold hover:bg-red-100 transition">
             Déconnexion
           </button>
        </div>
      </aside>

      {/* 4. CONTENU PRINCIPAL */}
      <main className="flex-1 p-4 md:p-10 max-w-4xl overflow-y-auto min-h-screen" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url('https://images.unsplash.com/photo-1709496023433-96b349a55946?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDE4fHx8ZW58MHx8fHx8')`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
        
        <div className="bg-white/90 backdrop-blur p-5 rounded-2xl shadow-sm border border-gray-200 mb-8 mt-4 md:mt-0 relative z-10">
          <h3 className="font-bold mb-4 flex items-center gap-2">➕ Planifier un sujet (Actif)</h3>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-2">
              <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Titre..." className="flex-[2] p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 ring-indigo-200" />
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full md:w-auto p-3 bg-gray-50 border rounded-xl font-bold text-gray-600 cursor-pointer">
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <input type="text" value={courseLink} onChange={(e) => setCourseLink(e.target.value)} placeholder="🔗 Lien Cours" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
              <input type="text" value={exoLink} onChange={(e) => setExoLink(e.target.value)} placeholder="🔗 Lien Exos" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
            </div>
            <button onClick={handleAdd} className="bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg active:scale-95">Ajouter au planning</button>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 relative z-10">À faire aujourd'hui</h2>
        
        <div className="grid gap-4 mb-20 relative z-10">
          {topics.filter(t => t.next_review <= new Date().toISOString().split("T")[0]).map((topic) => (
            <div key={topic.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white/95 backdrop-blur rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="mb-3 sm:mb-0">
                <h3 className="font-bold text-lg text-gray-800">{topic.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold uppercase">{topic.subject || "Autre"}</span>
                    <span className="text-xs text-orange-500 font-bold flex items-center gap-1">🔥 Urgent</span>
                </div>
              </div>
              <button onClick={() => setStudyingTopic(topic)} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition transform active:scale-95">
                GO 🚀
              </button>
            </div>
          ))}
          
          {topics.filter(t => t.next_review <= new Date().toISOString().split("T")[0]).length === 0 && (
            <div className="text-center py-16 bg-white/50 backdrop-blur rounded-3xl border border-dashed border-gray-300">
                <p className="text-4xl mb-2">🏝️</p>
                <p className="text-gray-500 font-medium">Rien à faire pour aujourd'hui !</p>
                <p className="text-sm text-gray-400">Profite ou avance sur les sujets de demain.</p>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL DE RÉVISION (Optimisé) --- */}
      {studyingTopic && (
        <StudySessionModal 
            topic={studyingTopic} 
            onClose={() => setStudyingTopic(null)} 
            onReview={reviewTopic} 
        />
      )}
    </div> 
  ); 
}