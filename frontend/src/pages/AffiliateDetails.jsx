import { useEffect, useState } from "react";
import { 
  ArrowLeft, Calendar, TrendingUp, User, Mail, Phone, 
  MessageCircle, Wallet, History, Tag, Users, DollarSign, Filter, RefreshCw
} from "lucide-react";
import KpiGrid from "../components/KpiGrid";
import FinancialChart from "../components/FinancialChart";
import VerdictBadge from "../components/VerdictBadge";
import { calculateKpis } from "../utils/metrics";
import { getAffiliateVerdict } from "../utils/verdict";

export default function AffiliateDetails({ affiliate, onBack, dateFrom: initialDateFrom, dateTo: initialDateTo, isDarkMode }) {
  // --- ESTADOS DE DATA (LOCAL) ---
  const [localDateFrom, setLocalDateFrom] = useState(initialDateFrom);
  const [localDateTo, setLocalDateTo] = useState(initialDateTo);
  
  // Estes são os que realmente disparam a busca
  const [searchFrom, setSearchFrom] = useState(initialDateFrom);
  const [searchTo, setSearchTo] = useState(initialDateTo);

  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); 
  const [chartMetric, setChartMetric] = useState("profit");
  const [tableFilter, setTableFilter] = useState("all"); 
  const [exchangeRate, setExchangeRate] = useState(5.50); 

  // --- CONFIGURAÇÃO DE URL (VITAL PARA DEPLOY) ---
  const API_BASE = import.meta.env.PROD 
    ? "https://backend-seguroplay.onrender.com" // <--- SEU LINK DO RENDER AQUI
    : ""; // Localmente usa o proxy

  // --- PALETA DE CORES (Mantendo seu design original no Dark Mode) ---
  const t = {
    // Se for Dark Mode, usa as cores HEX originais (#1c1c1c). Se for Light, usa branco/cinza.
    bgMain: isDarkMode ? "bg-[#1c1c1c]" : "bg-white",
    border: isDarkMode ? "border-[#2a2a2a]" : "border-gray-200",
    textPrimary: isDarkMode ? "text-white" : "text-gray-900",
    textSecondary: isDarkMode ? "text-gray-400" : "text-gray-500",
    textMuted: isDarkMode ? "text-gray-500" : "text-gray-400",
    
    // Tabela estilo original
    tableHeader: isDarkMode ? "bg-[#151515]" : "bg-gray-100",
    tableRowHover: isDarkMode ? "hover:bg-[#252525]" : "hover:bg-gray-50",
    inputBg: isDarkMode ? "bg-[#151515]" : "bg-gray-50",
    inputBorder: isDarkMode ? "border-[#333]" : "border-gray-300",
    
    // Abas
    tabActive: isDarkMode ? "border-blue-500 text-white" : "border-blue-600 text-blue-600",
    tabInactive: isDarkMode ? "border-transparent text-gray-500 hover:text-gray-300" : "border-transparent text-gray-500 hover:text-gray-700",
    
    // Pequena correção para o ícone do calendário não sumir no preto
    calendarFix: isDarkMode ? "[&::-webkit-calendar-picker-indicator]:invert" : ""
  };

  const verdict = getAffiliateVerdict(affiliate);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString('pt-BR');
  };

  const formatMoney = (valueInUSD) => {
    if (!valueInUSD && valueInUSD !== 0) return "-";
    const valueInBRL = valueInUSD * exchangeRate;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valueInBRL);
  };

  // --- ATUALIZAR DATA ---
  const handleDateUpdate = () => {
    setSearchFrom(localDateFrom);
    setSearchTo(localDateTo);
  };

  // 1. CARREGA GRÁFICO
  useEffect(() => {
    async function fetchHistory() {
      if (!affiliate.id) return;
      try {
        setLoading(true);
        // Usa API_BASE para garantir que acha o backend
        const url = `${API_BASE}/api/affiliates/${affiliate.id}/history?date_from=${searchFrom}&date_to=${searchTo}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.history) {
          const formatted = data.history.map(h => ({
            ...h,
            name: new Date(h.name).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            Lucro: (Number(h.net_pnl) || 0) * exchangeRate, 
            Depositos: Number(h.ftds) || 0,
            Registros: Number(h.registrations) || 0
          }));
          setHistory(formatted);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    fetchHistory();
  }, [affiliate, searchFrom, searchTo, exchangeRate]);

  // 2. CARREGA RELATÓRIO DE JOGADORES (CORRIGIDO)
  useEffect(() => {
    if (activeTab === 'overview') return;
    async function fetchPlayers() {
      if (!affiliate.id) return;
      try {
        setLoadingPlayers(true);
        // Usa API_BASE e o endpoint correto de players
        const url = `${API_BASE}/api/affiliates/${affiliate.id}/players?date_from=${searchFrom}&date_to=${searchTo}`;
        const res = await fetch(url);
        const data = await res.json();
        setPlayers(data.players || []);
      } catch (err) { console.error(err); } finally { setLoadingPlayers(false); }
    }
    fetchPlayers();
  }, [affiliate, activeTab, searchFrom, searchTo]);

  // Filtros
  const countNewRegs = players.filter(p => p.registeredAt).length;
  const countFtds = players.filter(p => p.ftdDate).length; 

  const filteredList = players.filter(p => {
    if (tableFilter === "regs") return p.registeredAt; 
    if (tableFilter === "ftds") return p.ftdDate; 
    return true; 
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. CABEÇALHO */}
      <div className={`flex flex-col xl:flex-row gap-6 border-b pb-6 justify-between ${t.border}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className={`p-2 rounded-full transition-colors ${t.textSecondary} hover:text-white hover:bg-white/10`} title="Voltar"><ArrowLeft size={24} /></button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-2xl font-bold flex items-center gap-3 ${t.textPrimary}`}>
                  {affiliate["Affiliate username"] || affiliate.name}
                </h1>
                <VerdictBadge verdict={verdict} />
              </div>
              
              <div className={`flex flex-wrap items-center gap-4 mt-3 ${t.textSecondary}`}>
                <span className="flex items-center gap-1 text-sm"><User size={14} /> {affiliate.fullName || "Nome não cadastrado"}</span>
                
                {/* DATA LOCAL */}
                <div className={`flex items-center gap-2 p-1 rounded-lg border ${t.inputBg} ${t.inputBorder}`}>
                  <Calendar size={14} className="text-blue-500 ml-1"/>
                  <input 
                    type="date" 
                    value={localDateFrom}
                    onChange={(e) => setLocalDateFrom(e.target.value)}
                    className={`bg-transparent text-xs border-none outline-none w-24 cursor-pointer ${t.textPrimary} ${t.calendarFix}`}
                  />
                  <span className="text-xs">até</span>
                  <input 
                    type="date" 
                    value={localDateTo}
                    onChange={(e) => setLocalDateTo(e.target.value)}
                    className={`bg-transparent text-xs border-none outline-none w-24 cursor-pointer ${t.textPrimary} ${t.calendarFix}`}
                  />
                  <button 
                    onClick={handleDateUpdate}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-md transition-colors"
                    title="Atualizar Período"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.inputBg} ${t.inputBorder}`}>
              <DollarSign size={14} className="text-green-500"/>
              <span className={`text-xs ${t.textSecondary}`}>USD:</span>
              <input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} step="0.01" className={`bg-transparent text-sm w-12 border-none outline-none font-bold ${t.textPrimary}`} />
            </div>
            {affiliate.phone && <a href={`https://wa.me/${affiliate.phone.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 text-sm font-medium"><MessageCircle size={16} /> WhatsApp</a>}
            {affiliate.email && <a href={`mailto:${affiliate.email}`} className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 text-sm font-medium"><Mail size={16} /> Email</a>}
          </div>
        </div>
        
        <div className="flex gap-4 shrink-0 mt-4 xl:mt-0">
          <div className={`p-4 rounded-xl min-w-[160px] flex flex-col justify-center shadow-lg border ${t.bgMain} ${t.border}`}>
            <div className={`flex items-center gap-2 text-[10px] uppercase font-bold mb-1 ${t.textSecondary}`}><Wallet size={12} className="text-yellow-500"/> Saldo a Pagar</div>
            <div className={`text-xl font-bold ${t.textPrimary}`}>{formatMoney(affiliate.balance)}</div>
          </div>
          <div className={`p-4 rounded-xl min-w-[160px] flex flex-col justify-center shadow-lg border ${t.bgMain} ${t.border}`}>
            <div className={`flex items-center gap-2 text-[10px] uppercase font-bold mb-1 ${t.textSecondary}`}><History size={12} className="text-blue-500"/> Total Pago</div>
            <div className={`text-xl font-bold ${t.textPrimary}`}>{formatMoney(affiliate.payments)}</div>
          </div>
        </div>
      </div>

      <div className={`border-b flex gap-6 ${t.border}`}>
        <button onClick={() => setActiveTab('overview')} className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'overview' ? t.tabActive : t.tabInactive}`}>Visão Geral</button>
        <button onClick={() => setActiveTab('players')} className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'players' ? t.tabActive : t.tabInactive}`}>Relatório de Registros</button>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6 animate-fade-in">
          <KpiGrid kpis={calculateKpis([affiliate])} />
          <div className={`border rounded-xl p-6 shadow-lg ${t.bgMain} ${t.border}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`font-medium flex items-center gap-2 ${t.textPrimary}`}><TrendingUp size={18} className="text-blue-500"/> Evolução Diária</h3>
              <div className={`flex rounded-lg p-1 ${isDarkMode ? 'bg-[#121212]' : 'bg-gray-100'}`}>
                  {[{ id: 'profit', label: 'Lucro' }, { id: 'ftds', label: 'FTDs' }, { id: 'regs', label: 'Registros' }].map(tab => (
                    <button key={tab.id} onClick={() => setChartMetric(tab.id)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMetric === tab.id ? (isDarkMode ? 'bg-[#2a2a2a] text-white' : 'bg-white text-gray-900 shadow-sm') : t.textSecondary}`}>{tab.label}</button>
                  ))}
              </div>
            </div>
            {loading ? <div className={`h-[300px] flex items-center justify-center ${t.textSecondary}`}>Carregando histórico...</div> : history.length > 0 ? <FinancialChart data={history} activeMetric={chartMetric} /> : <div className={`h-[300px] flex items-center justify-center border border-dashed rounded-lg ${t.textSecondary} ${t.border}`}>Sem dados neste período.</div>}
          </div>
        </div>
      ) : (
        /* RELATÓRIO COMPLETO - DESIGN RESTAURADO */
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setTableFilter("all")} className={`flex-1 min-w-[140px] p-3 rounded-xl border transition-all text-left ${tableFilter === 'all' ? (isDarkMode ? 'bg-[#252525] border-blue-500/50' : 'bg-blue-50 border-blue-400') : `${t.bgMain} ${t.border}`}`}>
              <div className={`text-xs mb-1 ${t.textSecondary}`}>Total Registrados</div>
              <div className={`text-xl font-bold ${t.textPrimary}`}>{players.length}</div>
            </button>
            <button onClick={() => setTableFilter("ftds")} className={`flex-1 min-w-[140px] p-3 rounded-xl border transition-all text-left ${tableFilter === 'ftds' ? 'bg-emerald-500/10 border-emerald-500/50' : `${t.bgMain} ${t.border}`}`}>
              <div className="text-xs text-emerald-300 mb-1">Com Depósito (FTD)</div>
              <div className="text-xl font-bold text-emerald-400">{countFtds}</div>
            </button>
          </div>

          <div className={`border rounded-xl overflow-hidden shadow-lg overflow-x-auto ${t.bgMain} ${t.border}`}>
            {loadingPlayers ? <div className={`p-20 text-center ${t.textSecondary}`}>Buscando dados na Smartico...</div> : (
              <table className="w-full text-xs text-left min-w-[1000px]">
                {/* CABEÇALHO RESTAURADO COM FUNDO ESCURO */}
                <thead className={`${t.tableHeader} ${t.textSecondary} border-b ${t.border} uppercase font-semibold`}>
                  <tr>
                    <th className={`px-4 py-3 sticky left-0 ${t.tableHeader}`}>ID / Usuário</th>
                    <th className="px-4 py-3 text-center">Data Registro</th>
                    <th className="px-4 py-3 text-center">Data FTD</th>
                    <th className="px-4 py-3 text-right text-emerald-500">Valor FTD</th>
                    <th className="px-4 py-3 text-center">Deps #</th>
                    <th className="px-4 py-3 text-right text-red-400">Saques</th>
                    <th className="px-4 py-3 text-right text-blue-400">Volume</th>
                    <th className="px-4 py-3 text-right">Net P&L</th>
                    <th className="px-4 py-3 text-center">Q-CPA</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-[#2a2a2a]' : 'divide-gray-200'}`}>
                  {filteredList.map((p, i) => (
                    <tr key={i} className={`transition-colors ${t.tableRowHover}`}>
                      {/* COLUNA STICKY COM COR CORRETA */}
                      <td className={`px-4 py-3 sticky left-0 font-mono font-medium border-r ${isDarkMode ? 'bg-[#1c1c1c] text-white border-[#2a2a2a]' : 'bg-white text-gray-900 border-gray-200'}`}>
                        <div>{p.playerId}</div>
                        {p.username && p.username !== "-" && <div className={`text-[10px] truncate max-w-[100px] ${t.textMuted}`}>{p.username}</div>}
                      </td>
                      <td className={`px-4 py-3 text-center ${t.textSecondary}`}>{formatDate(p.registeredAt)}</td>
                      <td className={`px-4 py-3 text-center ${t.textMuted}`}>{formatDate(p.ftdDate)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatMoney(p.ftdAmount)}</td>
                      <td className={`px-4 py-3 text-center ${t.textPrimary}`}>{p.depositsCount}</td>
                      <td className="px-4 py-3 text-right text-red-300">{formatMoney(p.withdrawals)}</td>
                      <td className="px-4 py-3 text-right text-blue-300">{formatMoney(p.volume)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${p.netPl >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                        {formatMoney(p.netPl)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.qCpa === "Sim" ? <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">SIM</span> : <span className="text-gray-600">-</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredList.length === 0 && (
                    <tr><td colSpan="9" className={`px-6 py-12 text-center ${t.textSecondary}`}>Nenhum jogador encontrado com este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
