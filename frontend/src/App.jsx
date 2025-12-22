import { useState, useEffect } from "react";
import Layout from "./layout/Layout";
import Overview from "./pages/Overview";
import Affiliates from "./pages/Affiliates";
import AffiliateDetails from "./pages/AffiliateDetails";
import FileUploader from "./components/FileUploader";
import DateRangeFilter from "./components/DateRangeFilter"; 

export default function App() {
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("idle");
  
  // --- NOVO: ESTADO GLOBAL DO TEMA ---
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Estado Global de Datas
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: firstDay.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  });

  const loadFromApi = async (from, to) => {
    setLoading(true);
    try {
      if (from && to) setDateRange({ from, to });
      const qFrom = from || dateRange.from;
      const qTo = to || dateRange.to;

      const response = await fetch(`/api/affiliates?date_from=${qFrom}&date_to=${qTo}`);
      if (!response.ok) throw new Error("Falha na conexão");
      const data = await response.json();

      if (data.affiliates) {
        const normalized = data.affiliates.map(item => ({
          ...item,
          "Affiliate username": item.name,
          "Registrations": item.registrations,
          "FTDs": item.ftds,
          "Commissions": item.commission,
          "Net P&L": item.net_pnl,
          net_pnl: item.net_pnl,
          balance: Number(item.balance || 0),
          payments: Number(item.payments || 0)
        }));
        setRows(normalized);
        setApiStatus("success");
      }
    } catch (error) {
      console.error("API Offline ou Erro:", error);
      setApiStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFromApi(); }, []);

  const renderContent = () => {
    if (selectedAffiliate) {
      return (
        <AffiliateDetails 
          affiliate={selectedAffiliate} 
          dateFrom={dateRange.from} 
          dateTo={dateRange.to}
          onBack={() => setSelectedAffiliate(null)}
          // PASSAMOS O TEMA PARA O DETALHE
          isDarkMode={isDarkMode}
        />
      );
    }

    if (activeTab === "overview") return <Overview rows={rows} isDarkMode={isDarkMode} />;
    
    if (activeTab === "affiliates") {
      return (
        <Affiliates 
          rows={rows} 
          onSelectAffiliate={(aff) => setSelectedAffiliate(aff)} 
          isDarkMode={isDarkMode}
        />
      );
    }
  };

  return (
    // PASSAMOS O TEMA PARA O LAYOUT
    <Layout 
      activeTab={activeTab} 
      onTabChange={(tab) => { setActiveTab(tab); setSelectedAffiliate(null); }}
      isDarkMode={isDarkMode}
      toggleTheme={() => setIsDarkMode(!isDarkMode)}
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Dashboard de Afiliados</h1>
            <div className="flex items-center gap-2 mt-1">
              {loading ? (
                <span className="text-yellow-500 text-sm animate-pulse">● Atualizando dados...</span>
              ) : apiStatus === "success" ? (
                <span className="text-green-500 text-sm">● Dados de {new Date(dateRange.from).toLocaleDateString()} a {new Date(dateRange.to).toLocaleDateString()}</span>
              ) : (
                <span className="text-gray-400 text-sm">● Modo Offline</span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <DateRangeFilter 
              initialDateFrom={dateRange.from}
              initialDateTo={dateRange.to}
              onFilter={(from, to) => loadFromApi(from, to)}
              isDarkMode={isDarkMode} // Se precisar passar estilo
            />
            <FileUploader onLoad={(data) => { setRows(data); setApiStatus("manual"); setActiveTab("overview"); }} />
          </div>
        </div>

        <main>
          {rows.length > 0 ? (
            renderContent()
          ) : (
            <div className={`flex flex-col items-center justify-center p-20 rounded-xl border text-center mt-6 ${isDarkMode ? 'bg-[#1c1c1c] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
              {loading ? (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className={isDarkMode ? 'text-white' : 'text-gray-600'}>Carregando dados...</p>
                </div>
              ) : (
                <h2 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Sem dados disponíveis</h2>
              )}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}