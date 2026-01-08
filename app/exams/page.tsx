"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Streak from "@/components/Streak"; // On l'ajoute aussi ici

export default function Exams() {
  const [exams, setExams] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // État du menu

  useEffect(() => {
    // On charge juste les "topics" qui sont en mode examen (ou on simule)
    // Pour l'instant on affiche tout, tu pourras filtrer plus tard
    const fetchExams = async () => {
      const { data } = await supabase.from("topics").select("*");
      if (data) setExams(data);
    };
    fetchExams();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col md:flex-row">
      
      {/* --- HEADER MOBILE --- */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-indigo-600">🧠 Memory</h1>
            <Streak />
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-lg bg-gray-100">
            {isMobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* --- SIDEBAR RESPONSIVE --- */}
      <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 p-6 flex flex-col h-screen transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} 
          md:translate-x-0 md:static md:w-80 md:shadow-none
      `}>
        <div className="hidden md:flex flex-col gap-3 mb-6">
            <h1 className="text-2xl font-extrabold text-indigo-600">🧠 Memory</h1>
            <div><Streak /></div>
        </div>
        
        <nav className="space-y-2">
          <Link href="/" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">🏠 Révisions</Link>
          <Link href="/exams" className="block p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition">🎓 Examens</Link>
          <Link href="/library" className="block p-3 rounded-xl hover:bg-gray-100 text-gray-600 font-medium transition">📚 Bibliothèque</Link>
        </nav>
      </aside>

      {/* --- FOND NOIR MOBILE --- */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* --- CONTENU --- */}
      <main className="flex-1 p-6 md:p-10">
        <h1 className="text-3xl font-bold mb-6">🎓 Mes Examens</h1>
        <p className="text-gray-500 mb-8">Liste de tes prochains partiels (À venir...)</p>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <p className="italic text-gray-400">Cette page est en construction !</p>
        </div>
      </main>
    </div>
  );
}