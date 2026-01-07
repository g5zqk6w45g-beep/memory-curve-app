export const dynamic = "force-dynamic";
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

type Exam = {
  id: number;
  title: string;
  date: string;
  topic_ids: number[]; // Nom DB (snake_case)
};

export default function ExamPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);

  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null);
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [viewMode, setViewMode] = useState<'docs' | 'cards'>('docs');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editSelectedTopics, setEditSelectedTopics] = useState<number[]>([]);

  // CHARGEMENT
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      // Charger Topics
      const { data: topicsData } = await supabase.from("topics").select("*");
      if (topicsData) setTopics(topicsData);

      // Charger Exams
      const { data: examsData } = await supabase.from("exams").select("*");
      if (examsData) setExams(examsData);
    };
    init();
  }, [router]);

  // CHRONO
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    else if (timeLeft === 0) setIsTimerActive(false);
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  useEffect(() => {
    if (studyingTopic) { 
      setTimeLeft(20 * 60); setIsTimerActive(false); setViewMode('docs'); setCurrentCardIndex(0); setIsFlipped(false);
    }
  }, [studyingTopic]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const toggleTopicSelection = (id: number) => {
    if (selectedTopics.includes(id)) setSelectedTopics(selectedTopics.filter(t => t !== id));
    else setSelectedTopics([...selectedTopics, id]);
  };

  const addExam = async () => {
    if (!examTitle || !examDate || !user) return;
    const newExam = {
      user_id: user.id,
      title: examTitle,
      date: examDate,
      topic_ids: selectedTopics
    };
    const { data, error } = await supabase.from("exams").insert([newExam]).select();
    if (!error && data) {
      setExams([...exams, data[0]]);
      setExamTitle(""); setExamDate(""); setSelectedTopics([]);
    }
  };

  const deleteExam = async (id: number) => {
    if(confirm("Supprimer cet examen définitivement ?")) {
      setExams(exams.filter(e => e.id !== id));
      await supabase.from("exams").delete().eq("id", id);
    }
  };

  const openEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setEditSelectedTopics(exam.topic_ids || []);
  };

  const toggleEditTopicSelection = (id: number) => {
    if (editSelectedTopics.includes(id)) setEditSelectedTopics(editSelectedTopics.filter(t => t !== id));
    else setEditSelectedTopics([...editSelectedTopics, id]);
  };

  const saveEditedExam = async () => {
    if (!editingExam) return;
    // Optimiste
    const updatedExams = exams.map(e => e.id === editingExam.id ? { ...e, topic_ids: editSelectedTopics } : e);
    setExams(updatedExams);
    setEditingExam(null);
    // DB
    await supabase.from("exams").update({ topic_ids: editSelectedTopics }).eq("id", editingExam.id);
  };

  const reviewCourse = async (id: number, difficulty: 'easy' | 'hard') => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;
    let daysToAdd = 1;
    let newStage = topic.stage;
    if (difficulty === 'hard') { daysToAdd = 1; newStage = 0; } 
    else {
       if (topic.stage === 0) daysToAdd = 2;       
       else if (topic.stage === 1) daysToAdd = 7;  
       else if (topic.stage === 2) daysToAdd = 14; 
       else daysToAdd = 30;
       newStage = topic.stage + 1;
    }
    const newDate = new Date(); newDate.setDate(newDate.getDate() + daysToAdd);
    const nextReviewStr = newDate.toISOString().split("T")[0];

    // Note : Ici on ne met pas à jour le state 'topics' car on est sur la page Exams, 
    // mais on update la DB pour que ce soit synchro partout.
    await supabase.from("topics").update({ stage: newStage, next_review: nextReviewStr }).eq("id", id);
    setStudyingTopic(null);
  };

  const nextCard = () => {
    if (!studyingTopic?.flashcards) return;
    setIsFlipped(false);
    setTimeout(() => {
        if (currentCardIndex < studyingTopic.flashcards!.length - 1) {
            setCurrentCardIndex(currentCardIndex + 1);
        } else {
            setCurrentCardIndex(0);
        }
    }, 200);
  };

  const getDaysLeft = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const examDate = new Date(dateStr);
    const now = new Date(today);
    const diff = examDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingExams = exams.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));
  const pastExams = exams.filter(e => e.date < todayStr).sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col h-auto md:h-screen sticky top-0 z-10">
        <h1 className="text-2xl font-extrabold text-indigo-600 mb-6">🧠 Memory</h1>
        <nav className="space-y-2">
          <Link href="/" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🏠 Révisions</Link>
          <Link href="/exams" className="block p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition">🎓 Examens</Link>
          <Link href="/library" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">📚 Bibliothèque</Link>
        </nav>
        <div className="mt-auto pt-6 text-xs text-gray-400">Planifie ta réussite.</div>
      </aside>

      <main className="flex-1 p-4 md:p-10 max-w-5xl overflow-y-auto min-h-screen" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), url('https://www.warehouse-nantes.fr/media/cache/media_upload/assets/images/bg/bg-home-GOO_d3F.webp')`, backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
        <h2 className="text-3xl font-bold mb-8 relative z-10">🎯 Objectifs & Examens</h2>

        <div className="bg-white/90 backdrop-blur p-6 rounded-2xl shadow-sm border border-gray-200 mb-10">
          <h3 className="font-bold text-lg mb-4">Nouvel Examen</h3>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <input type="text" placeholder="Matière (ex: Partiel de Physique)" value={examTitle} onChange={e => setExamTitle(e.target.value)} className="flex-1 p-3 bg-gray-50 border rounded-xl" />
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="p-3 bg-gray-50 border rounded-xl" />
          </div>
          <div className="mb-4">
            <p className="text-sm font-bold text-gray-500 mb-2">Chapitres à réviser :</p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
              {topics.map(t => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition">
                  <input type="checkbox" checked={selectedTopics.includes(t.id)} onChange={() => toggleTopicSelection(t.id)} className="w-5 h-5 accent-indigo-600" />
                  <span className="text-sm text-gray-700">{t.title} <span className="text-gray-400 text-xs">({t.subject || '-'})</span></span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={addExam} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition">Planifier</button>
        </div>

        <div className="grid gap-6 mb-12">
          {upcomingExams.map(exam => {
            const daysLeft = getDaysLeft(exam.date);
            const isUrgent = daysLeft <= 3;
            return (
              <div key={exam.id} className="bg-white/95 backdrop-blur p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${isUrgent ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div className="flex justify-between items-start mb-4 pl-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{exam.title}</h3>
                    <p className="text-gray-500 text-sm">Prévu le {new Date(exam.date).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <div className={`text-center px-4 py-2 rounded-xl font-bold ${isUrgent ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>J - {daysLeft}</div>
                </div>
                <div className="pl-4">
                  <div className="flex flex-wrap gap-2">
                    {exam.topic_ids && exam.topic_ids.map(tId => {
                      const topic = topics.find(t => t.id === tId);
                      return topic ? (
                        <button key={tId} onClick={() => setStudyingTopic(topic)} className="bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 text-xs px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2 group transition">
                          {topic.title} <span className="opacity-0 group-hover:opacity-100">👁</span>
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEditModal(exam)} className="bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 p-2 rounded-lg transition shadow-sm">✏️</button>
                  <button onClick={() => deleteExam(exam.id)} className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 p-2 rounded-lg transition shadow-sm">🗑</button>
                </div>
              </div>
            );
          })}
           {upcomingExams.length === 0 && <p className="text-center text-gray-500 italic">Aucun examen à venir.</p>}
        </div>

        {pastExams.length > 0 && (
          <div className="border-t border-gray-300 pt-8 opacity-70">
            <h3 className="text-xl font-bold text-gray-600 mb-6 flex items-center gap-2">📜 Historique</h3>
            <div className="grid gap-4">
              {pastExams.map(exam => (
                <div key={exam.id} className="bg-gray-100 p-4 rounded-xl border border-gray-200 flex justify-between items-center grayscale hover:grayscale-0 transition duration-300">
                  <div>
                    <h3 className="font-bold text-gray-600 line-through">{exam.title}</h3>
                    <p className="text-xs text-gray-400">Passé le {new Date(exam.date).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <button onClick={() => deleteExam(exam.id)} className="text-gray-300 hover:text-red-500 px-3">🗑 Supprimer</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {editingExam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Modifier : {editingExam.title}</h3>
              <button onClick={() => setEditingExam(null)} className="font-bold">✕</button>
            </div>
            <div className="max-h-60 overflow-y-auto grid gap-2 bg-gray-50 p-3 rounded-xl border mb-6">
              {topics.map(t => (
                <label key={t.id} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white">
                  <input type="checkbox" checked={editSelectedTopics.includes(t.id)} onChange={() => toggleEditTopicSelection(t.id)} className="w-5 h-5 accent-indigo-600" />
                  <div><div className="font-medium text-gray-800">{t.title}</div><div className="text-xs text-gray-400">{t.subject || "Autre"}</div></div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingExam(null)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={saveEditedExam} className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {studyingTopic && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold truncate max-w-[150px]">{studyingTopic.title}</h2>
                <div className="flex bg-gray-200 p-1 rounded-lg gap-1">
                  <button onClick={() => setViewMode('docs')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'docs' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}>📄 Docs</button>
                  {studyingTopic.flashcards && studyingTopic.flashcards.length > 0 && <button onClick={() => setViewMode('cards')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>🃏 Cartes</button>}
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border shadow-sm">
                <span className={`font-mono text-2xl font-bold ${timeLeft < 60 ? 'text-red-500' : ''}`}>{formatTime(timeLeft)}</span>
                <button onClick={() => setIsTimerActive(!isTimerActive)}>{isTimerActive ? '⏸' : '▶'}</button>
              </div>
              <button onClick={() => setStudyingTopic(null)} className="font-bold text-xl px-2">✕</button>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100 relative">
              {viewMode === 'docs' && (
                <div className="absolute inset-0 flex flex-col md:flex-row divide-x">
                  <div className="flex-1 p-4 overflow-y-auto">
                    <h3 className="text-blue-600 font-bold mb-4">📖 Cours</h3>
                    {studyingTopic.course_link ? <iframe src={studyingTopic.course_link.replace('/view', '/preview')} className="w-full h-full min-h-[400px] border rounded" /> : <p className="italic text-gray-400">Rien</p>}
                    {studyingTopic.course_link && <a href={studyingTopic.course_link} target="_blank" className="block text-center mt-2 text-blue-500 underline">Ouvrir lien</a>}
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto">
                     <h3 className="text-green-600 font-bold mb-4">✏️ Exos</h3>
                     {studyingTopic.exercise_link ? <a href={studyingTopic.exercise_link} target="_blank" className="block p-4 bg-green-50 border border-green-200 rounded text-green-700 font-bold text-center">Voir Exos</a> : <p className="italic text-gray-400">Rien</p>}
                  </div>
                </div>
              )}
              {viewMode === 'cards' && studyingTopic.flashcards && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gray-100">
                  <div onClick={() => setIsFlipped(!isFlipped)} className="w-full max-w-2xl aspect-video bg-white rounded-3xl shadow-xl flex items-center justify-center cursor-pointer hover:shadow-2xl transition transform duration-500 relative" style={{ perspective: "1000px" }}>
                     <div className="text-center p-8">
                        <p className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-4">{isFlipped ? "Verso (Réponse)" : "Recto (Question)"}</p>
                        <h3 className={`text-2xl md:text-4xl font-bold ${isFlipped ? 'text-indigo-600' : 'text-gray-800'}`}>{isFlipped ? studyingTopic.flashcards[currentCardIndex].answer : studyingTopic.flashcards[currentCardIndex].question}</h3>
                        <p className="mt-8 text-gray-400 text-sm animate-pulse">(Clique pour retourner)</p>
                     </div>
                  </div>
                  <div className="mt-8 flex items-center gap-6">
                    <span className="font-mono text-gray-500">Carte {currentCardIndex + 1} / {studyingTopic.flashcards.length}</span>
                    <button onClick={nextCard} className="bg-black text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition shadow-lg">Suivante ➔</button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-center gap-4 bg-white">
               <button onClick={() => reviewCourse(studyingTopic.id, 'hard')} className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-xl">😰 Dur</button>
               <button onClick={() => reviewCourse(studyingTopic.id, 'easy')} className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl">✅ Fait</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}