"use client";

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
  user_id: string;
  title: string;
  subject?: string;
  course_link?: string;
  exercise_link?: string;
  is_active?: boolean;
  flashcards?: Flashcard[];
  stage: number;
  next_review: string;
};

type Subject = {
  id: number;
  name: string;
};

// Liste par défaut (toujours visible)
const DEFAULT_SUBJECTS = ["Maths", "Physique", "Anglais", "Info", "Histoire", "Autre"];

// --- HOOK LOGIQUE ---
function useLibraryLogic() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Initialisation
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      
      // 1. Charger les cours
      const { data: topicData, error: topicError } = await supabase
        .from("topics")
        .select("*")
        .order('id', { ascending: false });
      if (!topicError && topicData) setTopics(topicData);

      // 2. Charger les matières
      fetchSubjects();
    };
    init();
  }, [router]);

  const fetchSubjects = async () => {
      // On récupère les matières perso de la DB
      const { data, error } = await supabase.from("subjects").select("*");
      const dbSubjects = (!error && data) ? data.map((s: Subject) => s.name) : [];

      // FUSION : Défauts + DB (sans doublons)
      const combinedSubjects = Array.from(new Set([...DEFAULT_SUBJECTS, ...dbSubjects]));
      
      // Tri alphabétique
      setSubjects(combinedSubjects.sort());
  };

  // Gestion des Matières
  const createSubject = async (name: string) => {
     if(!name.trim()) return;
     // On ajoute en DB
     const { error } = await supabase.from("subjects").insert([{ name }]);
     if (!error) fetchSubjects(); // On recharge la liste fusionnée
  };

  const deleteSubjectDB = async (name: string) => {
      // On supprime de la DB
      await supabase.from("subjects").delete().eq("name", name);
      fetchSubjects(); // On recharge (si c'était un défaut, il restera affiché car il est dans DEFAULT_SUBJECTS)
  };

  // Ajouter un cours
  const addTopic = async (title: string, subject: string, courseLink: string, exoLink: string) => {
    if (!title.trim() || !user) return;
    const newTopic = {
      user_id: user.id,
      title,
      stage: 0,
      next_review: new Date().toISOString().split("T")[0],
      course_link: courseLink,
      exercise_link: exoLink,
      subject,
      is_active: false,
      flashcards: []
    };
    const { data, error } = await supabase.from("topics").insert([newTopic]).select();
    if (!error && data) setTopics([data[0], ...topics]);
  };

  // Mettre à jour (ex: changer matière)
  const updateTopic = async (id: number, fields: Partial<Topic>) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
    await supabase.from("topics").update(fields).eq("id", id);
  };

  const deleteTopic = async (id: number) => {
    if (!confirm("Supprimer définitivement ?")) return;
    setTopics(prev => prev.filter(t => t.id !== id));
    await supabase.from("topics").delete().eq("id", id);
  };

  const reviewTopic = async (id: number, difficulty: 'easy' | 'hard') => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;

    let newStage = topic.stage;
    let daysToAdd = 1;

    if (difficulty === 'hard') {
      newStage = 0;
      daysToAdd = 1;
    } else {
      const intervals = [2, 7, 14, 30]; 
      daysToAdd = topic.stage < intervals.length ? intervals[topic.stage] : 60;
      newStage = topic.stage + 1;
    }

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    const nextReviewStr = newDate.toISOString().split("T")[0];

    await updateTopic(id, { stage: newStage, next_review: nextReviewStr });
  };

  return { topics, subjects, user, addTopic, updateTopic, deleteTopic, reviewTopic, createSubject, deleteSubjectDB };
}

// --- SOUS-COMPOSANT : GESTION DES MATIÈRES ---
function SubjectManager({ subjects, onAdd, onDelete, onClose }: { subjects: string[], onAdd: (n: string)=>void, onDelete: (n: string)=>void, onClose: ()=>void }) {
    const [newSub, setNewSub] = useState("");
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-bold text-gray-800">⚙️ Tes Matières</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-black font-bold">✕</button>
                </div>
                
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newSub} 
                        onChange={(e)=>setNewSub(e.target.value)}
                        placeholder="Nouvelle matière..." 
                        className="flex-1 border rounded-lg p-2 outline-none focus:ring-2 ring-indigo-200"
                    />
                    <button onClick={() => { onAdd(newSub); setNewSub(""); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700">+</button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                    {subjects.map(s => (
                        <div key={s} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                            <span className="font-medium text-gray-700">{s}</span>
                            {/* On n'affiche le bouton supprimer que si ce n'est PAS une matière par défaut (optionnel, ici on laisse tout) */}
                            <button onClick={() => onDelete(s)} className="text-red-400 hover:text-red-600 text-sm font-bold">Supprimer</button>
                        </div>
                    ))}
                    {subjects.length === 0 && <p className="text-center text-gray-400 italic">Aucune matière.</p>}
                </div>
                <div className="mt-4 pt-2 border-t text-xs text-gray-400">
                    Note : Les matières par défaut (Maths, etc.) réapparaîtront toujours.
                </div>
            </div>
        </div>
    );
}

// --- SOUS-COMPOSANTS MODALS (StudySession & Flashcards) ---
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

  const handleNextCard = () => {
    if (!topic.flashcards) return;
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentCardIndex(prev => (prev < (topic.flashcards?.length || 0) - 1 ? prev + 1 : 0));
    }, 200);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold truncate max-w-[150px]">{topic.title}</h2>
            <div className="flex bg-gray-200 p-1 rounded-lg gap-1">
              <button onClick={() => setViewMode('docs')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'docs' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}>📄 Docs</button>
              {topic.flashcards && topic.flashcards.length > 0 && <button onClick={() => setViewMode('cards')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>🃏 Cartes</button>}
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border shadow-sm">
            <span className={`font-mono text-2xl font-bold ${timeLeft < 60 ? 'text-red-500' : ''}`}>{formatTime(timeLeft)}</span>
            <button onClick={() => setIsTimerActive(!isTimerActive)}>{isTimerActive ? '⏸' : '▶'}</button>
          </div>
          <button onClick={onClose} className="font-bold text-xl px-2 hover:text-red-500">✕</button>
        </div>
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
                 {topic.exercise_link ? <a href={topic.exercise_link} target="_blank" className="block p-4 bg-green-50 border border-green-200 rounded text-green-700 font-bold text-center">Voir Exos</a> : <p className="italic text-gray-400">Rien</p>}
              </div>
            </div>
          )}
          {viewMode === 'cards' && topic.flashcards && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gray-100">
              <div onClick={() => setIsFlipped(!isFlipped)} className="w-full max-w-2xl aspect-video bg-white rounded-3xl shadow-xl flex items-center justify-center cursor-pointer hover:shadow-2xl transition-all duration-500 relative perspective-1000">
                 <div className="text-center p-8 select-none">
                    <p className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-4">{isFlipped ? "Verso (Réponse)" : "Recto (Question)"}</p>
                    <h3 className={`text-2xl md:text-4xl font-bold transition-colors duration-300 ${isFlipped ? 'text-indigo-600' : 'text-gray-800'}`}>{isFlipped ? topic.flashcards[currentCardIndex].answer : topic.flashcards[currentCardIndex].question}</h3>
                    <p className="mt-8 text-gray-300 text-xs animate-pulse">(Clique pour retourner)</p>
                 </div>
              </div>
              <div className="mt-8 flex items-center gap-6">
                <span className="font-mono text-gray-500">Carte {currentCardIndex + 1} / {topic.flashcards.length}</span>
                <button onClick={handleNextCard} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition shadow-lg active:scale-95">Suivante ➔</button>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-center gap-4 bg-white">
           <button onClick={() => { onReview(topic.id, 'hard'); onClose(); }} className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition">😰 Dur</button>
           <button onClick={() => { onReview(topic.id, 'easy'); onClose(); }} className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-200">✅ Fait</button>
        </div>
      </div>
    </div>
  );
}

function FlashcardManager({ topic, onClose, onUpdate }: { topic: Topic, onClose: () => void, onUpdate: (id: number, cards: Flashcard[]) => void }) {
    const [q, setQ] = useState("");
    const [a, setA] = useState("");

    const add = () => {
        if(!q || !a) return;
        const newCards = [...(topic.flashcards || []), { id: Date.now(), question: q, answer: a }];
        onUpdate(topic.id, newCards);
        setQ(""); setA("");
    };

    const remove = (cardId: number) => {
        const newCards = topic.flashcards?.filter(c => c.id !== cardId) || [];
        onUpdate(topic.id, newCards);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-xl font-bold">🃏 Flashcards : {topic.title}</h3>
              <button onClick={onClose} className="font-bold text-gray-400 hover:text-black">✕</button>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recto : La Question ?" className="w-full p-2 mb-2 border rounded-lg" />
              <input type="text" value={a} onChange={(e) => setA(e.target.value)} placeholder="Verso : La Réponse..." className="w-full p-2 mb-2 border rounded-lg" />
              <button onClick={add} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700">Ajouter la carte</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {topic.flashcards && topic.flashcards.length > 0 ? (
                topic.flashcards.map((card) => (
                  <div key={card.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                    <div className="flex-1"><p className="font-bold text-sm text-gray-800">Q: {card.question}</p><p className="text-sm text-gray-500">R: {card.answer}</p></div>
                    <button onClick={() => remove(card.id)} className="text-red-300 hover:text-red-500 ml-2 p-2">🗑</button>
                  </div>
                ))
              ) : <p className="text-center text-gray-400 italic mt-4">Aucune carte.</p>}
            </div>
          </div>
        </div>
    );
}

// --- COMPOSANT PRINCIPAL ---
export default function LibraryPage() {
  const { topics, subjects, updateTopic, deleteTopic, addTopic, reviewTopic, createSubject, deleteSubjectDB } = useLibraryLogic();
  
  // États UI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSubjectManager, setShowSubjectManager] = useState(false); 
  const [filterSubject, setFilterSubject] = useState("Tout");
  const [searchTerm, setSearchTerm] = useState("");
  
  // États Formulaire
  const [inputVal, setInputVal] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(""); 
  const [courseLink, setCourseLink] = useState("");
  const [exoLink, setExoLink] = useState("");

  // Modals
  const [flashcardTopic, setFlashcardTopic] = useState<Topic | null>(null);
  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null);

  // Auto-select first subject when loaded
  useEffect(() => {
      if (subjects.length > 0 && !selectedSubject) {
          setSelectedSubject(subjects[0]);
      }
  }, [subjects, selectedSubject]);

  const handleAdd = async () => {
      await addTopic(inputVal, selectedSubject || subjects[0], courseLink, exoLink);
      setInputVal(""); setCourseLink(""); setExoLink("");
  };

  const handleFlashcardUpdate = async (topicId: number, newCards: Flashcard[]) => {
     await updateTopic(topicId, { flashcards: newCards });
     setFlashcardTopic(prev => prev ? { ...prev, flashcards: newCards } : null);
  };

  const filteredTopics = topics.filter(t => {
    const matchesSubject = filterSubject === "Tout" || (t.subject || "Autre") === filterSubject;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row relative">
      
      {/* 1. HEADER MOBILE */}
      <div className="md:hidden bg-white p-4 border-b flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <h1 className="text-xl font-extrabold text-indigo-600">🧠 Memory</h1>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 border rounded-lg hover:bg-gray-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* 2. SIDEBAR */}
      <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 p-6 flex flex-col h-screen transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0 md:sticky md:top-0 md:h-screen md:block
      `}>
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-extrabold text-indigo-600">🧠 Memory</h1>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        <nav className="space-y-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🏠 Révisions</Link>
          <Link href="/exams" onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🎓 Examens</Link>
          <Link href="/library" onClick={() => setIsMobileMenuOpen(false)} className="block p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition">📚 Bibliothèque</Link>
        </nav>
      </aside>

      {/* 3. MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-10 max-w-7xl overflow-y-auto min-h-screen" 
            style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url('https://polelrsy.univ-nantes.fr/medias/photo/bu-travail_1669802335851-png')`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10 gap-4">
             <h2 className="text-3xl font-bold">📚 Ta Bibliothèque</h2>
             <button onClick={() => setShowSubjectManager(true)} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition border">
                 ⚙️ Gérer les matières
             </button>
        </div>

        {/* AJOUTER */}
        <div className="bg-white/90 backdrop-blur p-5 rounded-2xl shadow-sm border border-gray-200 mb-8 relative z-10">
          <h3 className="font-bold mb-3 text-gray-700">📥 Ajouter un cours</h3>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-2">
              <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Titre du cours..." className="flex-[2] p-3 bg-gray-50 border rounded-xl focus:ring-2 ring-indigo-200 outline-none" />
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full md:w-auto p-3 bg-gray-50 border rounded-xl font-bold text-gray-600 cursor-pointer">
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <input type="text" value={courseLink} onChange={(e) => setCourseLink(e.target.value)} placeholder="🔗 Lien Cours" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
              <input type="text" value={exoLink} onChange={(e) => setExoLink(e.target.value)} placeholder="🔗 Lien Exos" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
            </div>
            <button onClick={handleAdd} className="bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900 transition shadow-lg">Ajouter à la liste</button>
          </div>
        </div>

        {/* FILTRES */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 relative z-10">
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
             <button onClick={() => setFilterSubject("Tout")} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold transition shadow-sm ${filterSubject === "Tout" ? "bg-black text-white" : "bg-white/90 border text-gray-600 hover:bg-white"}`}>Tout</button>
            {subjects.map(subj => (
              <button key={subj} onClick={() => setFilterSubject(subj)} 
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-bold transition shadow-sm ${filterSubject === subj ? "bg-black text-white" : "bg-white/90 backdrop-blur border border-gray-200 text-gray-600 hover:bg-white"}`}>
                {subj}
              </button>
            ))}
          </div>
          <input type="text" placeholder="🔍 Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-3 border rounded-xl w-full md:w-64 shadow-sm outline-none bg-white/90 backdrop-blur focus:ring-2 ring-indigo-100" />
        </div>

        {/* LISTE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
          {filteredTopics.map(topic => {
            const isActive = topic.is_active !== false; 
            const flashcardCount = topic.flashcards ? topic.flashcards.length : 0;
            return (
              <div key={topic.id} className={`p-5 rounded-2xl shadow-sm border transition flex flex-col group relative ${isActive ? 'bg-white/95 border-gray-200' : 'bg-gray-100/90 border-gray-200 grayscale-[0.5]'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className={`text-xs font-bold px-2 py-1 rounded uppercase ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>{topic.subject || "Autre"}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateTopic(topic.id, { is_active: !topic.is_active })} className={`p-1.5 rounded-lg font-bold text-xs transition border ${isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-200 text-gray-600 border-gray-300'}`}>
                        {isActive ? "Actif" : "Inactif"}
                    </button>
                    <button onClick={() => setFlashcardTopic(topic)} className="bg-orange-50 hover:bg-orange-100 text-orange-600 p-1.5 rounded-lg border border-orange-200 transition">
                      🃏 <span className="text-xs font-bold">{flashcardCount}</span>
                    </button>
                    <button onClick={() => deleteTopic(topic.id)} className="text-gray-300 hover:text-red-500 transition p-1">🗑</button>
                  </div>
                </div>
                
                <h3 className={`font-bold text-lg mb-2 flex-1 ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{topic.title}</h3>
                <select className="text-xs bg-transparent text-gray-400 outline-none cursor-pointer hover:text-indigo-600 mb-4 w-full" value={topic.subject || "Autre"} onChange={(e) => updateTopic(topic.id, { subject: e.target.value })}>
                    <option value="Autre">Changer matière...</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setStudyingTopic(topic)} className={`w-full py-2.5 rounded-xl font-bold text-sm mb-3 shadow-sm transition active:scale-95 ${isActive ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}`}>🚀 Lancer Session</button>
                <div className="flex gap-2 mt-auto">
                  {topic.course_link ? <a href={topic.course_link} target="_blank" className="flex-1 py-2 text-center bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition">📄 Cours</a> : <span className="flex-1 py-2 text-center bg-gray-50 text-gray-300 rounded-lg text-sm cursor-not-allowed">Pas de doc</span>}
                  {topic.exercise_link ? <a href={topic.exercise_link} target="_blank" className="flex-1 py-2 text-center bg-green-50 text-green-600 rounded-lg text-sm font-bold hover:bg-green-100 transition">✏️ Exos</a> : <span className="flex-1 py-2 text-center bg-gray-50 text-gray-300 rounded-lg text-sm cursor-not-allowed">Pas d'exos</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODALS */}
      {showSubjectManager && (
          <SubjectManager 
              subjects={subjects} 
              onAdd={createSubject} 
              onDelete={deleteSubjectDB} 
              onClose={() => setShowSubjectManager(false)} 
          />
      )}
      {flashcardTopic && <FlashcardManager topic={flashcardTopic} onClose={() => setFlashcardTopic(null)} onUpdate={handleFlashcardUpdate} />}
      {studyingTopic && <StudySessionModal topic={studyingTopic} onClose={() => setStudyingTopic(null)} onReview={reviewTopic} />}
    </div>
  );
}