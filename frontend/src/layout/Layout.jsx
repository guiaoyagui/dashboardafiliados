import { useState } from "react";
import { LayoutDashboard, Users, ChevronLeft, Menu, LogOut } from "lucide-react";

export default function Layout({ children, activeTab, onTabChange }) {
  // Estado para controlar se a sidebar está aberta ou fechada
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    { id: "affiliates", label: "Afiliados", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden font-sans">
      
      {/* --- SIDEBAR --- */}
      <aside 
        className={`bg-[#1c1c1c] border-r border-[#2a2a2a] flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Cabeçalho da Sidebar (Logo + Botão Toggle) */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#2a2a2a]">
          {/* Logo (Só aparece se aberto) - VOLTOU PARA VERMELHO */}
          <div className={`font-bold text-lg text-red-500 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0 hidden"}`}>
            Seguro Affiliate
          </div>

          {/* Botão de Fechar/Abrir */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors mx-auto"
            title={isOpen ? "Recolher menu" : "Expandir menu"}
          >
            {isOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 py-6 px-3 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                activeTab === item.id
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/20" // <-- CORRIGIDO PARA VERMELHO
                  : "text-gray-400 hover:bg-[#252525] hover:text-white"
              } ${!isOpen && "justify-center"}`}
            >
              <item.icon size={20} className="shrink-0" />
              
              {/* Texto (Só aparece se aberto) */}
              {isOpen && (
                <span className="font-medium truncate transition-all duration-300">
                  {item.label}
                </span>
              )}

              {/* Tooltip flutuante quando fechado */}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-gray-700">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Rodapé da Sidebar (Perfil) */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <button className={`w-full flex items-center gap-3 hover:bg-[#252525] p-2 rounded-lg transition-colors ${!isOpen && "justify-center"}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-[#2a2a2a]">
              SA
            </div>
            
            {isOpen && (
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-sm font-medium text-white truncate w-full">Admin User</span>
                <span className="text-xs text-gray-500 truncate w-full">Sair do sistema</span>
              </div>
            )}
            
            {isOpen && <LogOut size={16} className="ml-auto text-gray-500 hover:text-red-400" />}
          </button>
        </div>
      </aside>

      {/* --- ÁREA DE CONTEÚDO --- */}
      <main className="flex-1 overflow-auto relative">
        <div className="p-6 md:p-8 max-w-[1920px] mx-auto min-h-full">
          {children}
        </div>
      </main>

    </div>
  );
}