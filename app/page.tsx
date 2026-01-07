"use client";
import { useState, useEffect, useRef } from "react";

type Topic = {
  id: number;
  title: string;
  stage: number;
  next_review: string;
  courseLink?: string;
  exerciseLink?: string;
};

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [courseLink, setCourseLink] = useState("");
  const [exoLink, setExoLink] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  
  // États pour le mode Révision & Chrono
  const [studyingTopic, setStudyingTopic] = useState<Topic | null>(null);
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("my-courses");
    if (saved) setTopics(JSON.parse(saved));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem("my-courses", JSON.stringify(topics));
  }, [topics, isLoaded]);

  // Chronomètre
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  useEffect(() => {
    if (studyingTopic) {
      setTimeLeft(20 * 60);
      setIsTimerActive(false);
    }
  }, [studyingTopic]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const exportData = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(topics))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `memory-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        if (event.target?.result) {
          try {
            const parsedData = JSON.parse(event.target.result as string);
            if (Array.isArray(parsedData)) {
              if(confirm("Attention : Cela va remplacer tes cours actuels. Continuer ?")) {
                setTopics(parsedData);
                alert("Données chargées !");
              }
            }
          } catch (err) {
            alert("Fichier invalide.");
          }
        }
      };
    }
  };

  const addCourse = () => {
    if (inputVal.trim() === "") return;
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const newTopic: Topic = {
      id: Date.now(),
      title: inputVal,
      stage: 0,
      next_review: date.toISOString().split("T")[0],
      courseLink: courseLink,
      exerciseLink: exoLink,
    };
    setTopics([newTopic, ...topics]);
    setInputVal("");
    setCourseLink("");
    setExoLink("");
  };

  const reviewCourse = (id: number, difficulty: 'easy' | 'hard') => {
    setTopics(topics.map(topic => {
      if (topic.id === id) {
        let daysToAdd = 1;
        if (difficulty === 'hard') daysToAdd = 1;
        else {
           if (topic.stage === 0) daysToAdd = 3;
           if (topic.stage === 1) daysToAdd = 7;
           if (topic.stage === 2) daysToAdd = 14;
           if (topic.stage >= 3) daysToAdd = 30;
        }
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + daysToAdd);
        return { ...topic, stage: topic.stage + 1, next_review: newDate.toISOString().split("T")[0] };
      }
      return topic;
    }));
    setStudyingTopic(null);
  };

  const deleteCourse = (id: number) => {
    if (confirm("Supprimer ce cours ?")) {
      setTopics(topics.filter(t => t.id !== id));
      setStudyingTopic(null);
    }
  };

  const getGroupedTopics = () => {
    const groups: { [key: string]: Topic[] } = {};
    const sorted = [...topics].sort((a, b) => a.next_review.localeCompare(b.next_review));
    sorted.forEach(topic => {
      if (!groups[topic.next_review]) groups[topic.next_review] = [];
      groups[topic.next_review].push(topic);
    });
    return groups;
  };
  const groupedTopics = getGroupedTopics();
  const sortedDates = Object.keys(groupedTopics).sort();

  const formatDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) return "🔥 Aujourd'hui";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'short' });
  };

  if (!isLoaded) return <div className="p-10 text-center">Chargement...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row">
      
      {/* SIDEBAR INTERACTIVE */}
      <aside className="w-full md:w-80 bg-white border-r border-gray-200 p-6 flex flex-col h-auto md:h-screen sticky top-0">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-indigo-600 mb-1">🧠 Memory</h1>
          <p className="text-xs text-gray-400 font-bold uppercase">Planning (Cliquable)</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {sortedDates.length === 0 && <p className="text-gray-400 text-sm italic">Aucune révision.</p>}
          {sortedDates.map(date => {
             const isToday = date === new Date().toISOString().split("T")[0];
             return (
              <div key={date} className={`relative ${isToday ? 'bg-indigo-50 -mx-4 px-4 py-3 rounded-xl border border-indigo-100' : ''}`}>
                <h3 className={`font-bold capitalize mb-2 ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>{formatDateLabel(date)}</h3>
                <ul className="space-y-1 border-l-2 border-gray-100 pl-3">
                  {groupedTopics[date].map(t => (
                    // ICI : ON REND LES ÉLÉMENTS CLIQUABLES
                    <li 
                      key={t.id} 
                      onClick={() => setStudyingTopic(t)}
                      className="text-sm text-gray-500 truncate cursor-pointer hover:text-indigo-600 hover:bg-gray-100 py-1 px-2 rounded transition flex items-center gap-2 group"
                    >
                      <span className="opacity-0 group-hover:opacity-100 text-xs">👁</span>
                      {t.title}
                    </li>
                  ))}
                </ul>
              </div>
             )
          })}
        </div>

        {/* ZONE SAUVEGARDE */}
        <div className="mt-6 pt-6 border-t border-gray-100 flex gap-2">
          <button onClick={exportData} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-lg transition">📥 Sauver</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-lg transition">📤 Charger</button>
          <input type="file" ref={fileInputRef} onChange={importData} className="hidden" accept=".json" />
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-4 md:p-10 max-w-4xl overflow-y-auto h-screen">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <h3 className="font-bold mb-4 text-gray-800">➕ Ajouter un sujet</h3>
          <div className="flex flex-col gap-3">
            <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Titre..." className="p-3 bg-gray-50 border rounded-xl" />
            <div className="flex gap-2">
              <input type="text" value={courseLink} onChange={(e) => setCourseLink(e.target.value)} placeholder="🔗 Lien Cours" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
              <input type="text" value={exoLink} onChange={(e) => setExoLink(e.target.value)} placeholder="🔗 Lien Exos" className="flex-1 p-2 text-sm bg-gray-50 border rounded-lg" />
            </div>
            <button onClick={addCourse} className="bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition">Ajouter</button>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-gray-800">À faire aujourd'hui</h2>
        <div className="grid gap-4">
          {topics.filter(t => t.next_review <= new Date().toISOString().split("T")[0]).map((topic) => (
            <div key={topic.id} className="flex justify-between items-center p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{topic.title}</h3>
                <p className="text-xs text-orange-500 font-bold mt-1">🔥 Urgent</p>
              </div>
              <button onClick={() => setStudyingTopic(topic)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-indigo-100 shadow-lg hover:bg-indigo-700 transition">
                🚀 GO
              </button>
            </div>
          ))}
          {topics.filter(t => t.next_review <= new Date().toISOString().split("T")[0]).length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-400">Tout est à jour ! Regarde le planning à gauche.</div>
          )}
        </div>
      </main>

      {/* MODAL */}
      {studyingTopic && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 md:p-4">
          <div className="bg-white w-full max-w-6xl h-[95vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex flex-col">
                <h2 className="text-lg font-bold truncate max-w-[200px]">{studyingTopic.title}</h2>
                <span className="text-xs text-gray-500">Prévu le {studyingTopic.next_review}</span>
              </div>
              
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
                <span className={`font-mono text-2xl font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
                  {formatTime(timeLeft)}
                </span>
                <button onClick={() => setIsTimerActive(!isTimerActive)} className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition ${isTimerActive ? 'bg-orange-400' : 'bg-green-500'}`}>
                  {isTimerActive ? '⏸' : '▶'}
                </button>
              </div>

              <button onClick={() => setStudyingTopic(null)} className="bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 font-bold">✕</button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x overflow-hidden bg-gray-100">
              <div className="flex-1 p-4 overflow-y-auto">
                <h3 className="text-blue-600 font-bold mb-4">📖 Le Cours</h3>
                {studyingTopic.courseLink ? (
                  <iframe src={studyingTopic.courseLink.replace('/view', '/preview')} className="w-full h-full min-h-[400px] rounded-xl border bg-white" title="Cours" />
                ) : <div className="h-64 flex items-center justify-center text-gray-400 italic bg-white rounded-xl border">Pas de document</div>}
                {studyingTopic.courseLink && <a href={studyingTopic.courseLink} target="_blank" className="block mt-2 text-center text-sm text-blue-500 underline">Ouvrir dans un nouvel onglet</a>}
              </div>

              <div className="flex-1 p-4 overflow-y-auto bg-white">
                <h3 className="text-green-600 font-bold mb-4">✏️ Exercices</h3>
                {studyingTopic.exerciseLink ? (
                   <a href={studyingTopic.exerciseLink} target="_blank" className="block p-6 bg-green-50 border border-green-200 rounded-xl text-green-700 font-bold text-center hover:bg-green-100 transition">📝 Accéder aux Exercices</a>
                ) : <div className="text-gray-400 italic text-center mt-10">Pas d'exercices</div>}
              </div>
            </div>

            <div className="p-4 bg-white border-t flex justify-center gap-4">
               <button onClick={() => reviewCourse(studyingTopic.id, 'hard')} className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition">😰 Dur (Demain)</button>
               <button onClick={() => reviewCourse(studyingTopic.id, 'easy')} className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition shadow-lg">✅ Fait (Suivant)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}