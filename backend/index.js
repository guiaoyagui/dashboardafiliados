import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPERS ---
const findValue = (item, keys) => {
  if (!item) return 0;
  if (!Array.isArray(keys)) keys = [keys]; // Garante array
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) return Number(item[key]);
  }
  return 0;
};

const findDate = (item) => {
  if (!item) return null;
  // Tenta pegar de várias chaves ou usa o próprio item se for string
  if (typeof item === 'string') return item.split('T')[0];
  const candidates = [item.dt, item.period_date, item.PeriodDate, item.date, item.Date, item.day];
  for (const val of candidates) {
    if (val && typeof val === 'string' && val.length >= 10) return val.split('T')[0];
  }
  return null;
};

// --- ROTAS PADRÃO (LISTA E FINANCEIRO) ---
// (Mantidas exatamente como você pediu)
async function fetchAllProfiles() {
  let allProfiles = [];
  let start = 0;
  let limit = 1000;
  let hasMore = true;
  console.log("📂 Buscando perfis...");
  while (hasMore) {
    try {
      const response = await axios.get(`${process.env.SMARTICO_BASE_URL}/api/af2_aff_op`, {
        headers: { authorization: process.env.SMARTICO_API_KEY },
        params: { range: `[${start},${start + limit}]` }
      });
      const data = response.data || [];
      if (!Array.isArray(data) || data.length === 0) { hasMore = false; } 
      else { allProfiles = [...allProfiles, ...data]; start += limit; if (data.length < limit) hasMore = false; await delay(100); }
    } catch (e) { hasMore = false; }
  }
  return allProfiles;
}

async function fetchFinancialReport(params) {
  let allData = [];
  let limit = 200; 
  let offset = 0;
  let hasMore = true;
  let lastFirstId = null;
  console.log(`💰 Buscando financeiro...`);
  while (hasMore) {
    try {
      const response = await axios.get(`${process.env.SMARTICO_BASE_URL}/api/af2_media_report_op`, {
        headers: { authorization: process.env.SMARTICO_API_KEY },
        params: { ...params, limit, offset }
      });
      const data = response.data.data || [];
      if (data.length === 0) break;
      const currentSig = JSON.stringify({id: data[0].affiliate_id, val: data[0].commissions_total});
      if (currentSig === lastFirstId) break;
      lastFirstId = currentSig;
      allData = [...allData, ...data];
      if (data.length < limit) hasMore = false; else { offset += limit; await delay(100); }
    } catch (e) { hasMore = false; }
  }
  return allData;
}

app.get("/api/affiliates", async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const [profiles, financialData] = await Promise.all([
      fetchAllProfiles(),
      fetchFinancialReport({ aggregation_period: "MONTH", group_by: "affiliate_id,username", date_from, date_to })
    ]);
    const affiliateMap = {};
    const translateStatus = (s) => ({'Approved':'Ativo','Pending':'Pendente','Blocked':'Bloqueado'}[s] || s || 'Desconhecido');

    profiles.forEach(p => {
      if (p.affiliate_id === 468904 || (p.username && String(p.username).includes("DEFAULT"))) return;
      affiliateMap[p.affiliate_id] = {
        id: p.affiliate_id, name: p.username || `Affiliate ${p.affiliate_id}`, "Affiliate username": p.username,
        manager: p.manager_username || "Sem Gerente", country: p.country || "Global", deal: p.default_deal_info?.deal_group_name || "Padrão",
        status: translateStatus(p.aff_status_name), email: p.bo_user_email || "", phone: p.phone_number || "", skype: p.skype || "",
        fullName: [p.first_name, p.last_name].filter(Boolean).join(" "), balance: Number(p.balance || 0), payments: Number(p.payments || 0),
        label: p.label_name || "", created: p.create_date, registrations: 0, ftds: 0, commission: 0, net_pnl: 0
      };
    });

    financialData.forEach(item => {
      if (item.affiliate_id === 468904 || (item.username && String(item.username).includes("DEFAULT"))) return;
      const id = item.affiliate_id;
      if (!affiliateMap[id]) {
        affiliateMap[id] = {
          id: id, name: item.username || `Affiliate ${id}`, "Affiliate username": item.username,
          manager: "Sem Gerente", country: "Global", deal: "Padrão", status: "Ativo",
          email: "", phone: "", skype: "", fullName: "", balance: 0, payments: 0, label: "", created: null,
          registrations: 0, ftds: 0, commission: 0, net_pnl: 0
        };
      }
      affiliateMap[id].registrations += findValue(item, ['registration_count', 'RegistrationCount']);
      affiliateMap[id].ftds += findValue(item, ['ftd_count', 'FtdCount']);
      affiliateMap[id].commission += findValue(item, ['commissions_total', 'CommissionsTotal']);
      affiliateMap[id].net_pnl += findValue(item, ['net_pl', 'NetPL']);
    });

    const finalLista = Object.values(affiliateMap);
    finalLista.sort((a, b) => b.net_pnl - a.net_pnl);
    res.json({ affiliates: finalLista });
  } catch (error) { res.status(500).json({ error: "Erro interno" }); }
});

// =================================================================================
// ROTA 2: JOGADORES (RECONSTRUÇÃO VIA MEDIA REPORT - GARANTIA DE DADOS)
// =================================================================================
app.get("/api/affiliates/:id/players", async (req, res) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;

    console.log(`\n👥 Gerando Relatório Detalhado (ID: ${id})...`);

    const response = await axios.get(`${process.env.SMARTICO_BASE_URL}/api/af2_media_report_op`, {
      headers: { authorization: process.env.SMARTICO_API_KEY },
      params: { 
        date_from, 
        date_to,
        filter_affiliate_id: id, 
        aggregation_period: "DAY",
        group_by: "affiliate_id,registration_id,ext_customer_id,username,day", 
        limit: 3000 
      }
    });

    const rawData = response.data.data || [];
    console.log(`   -> Atividades encontradas: ${rawData.length}`);

    const playersMap = {};

    rawData.forEach(row => {
      if (row.affiliate_id && String(row.affiliate_id) !== String(id)) return;

      let displayId = row.ext_customer_id;
      if (!displayId || displayId === "0" || displayId === "null" || displayId.trim() === "") {
          displayId = row.registration_id; 
      }
      if (!displayId || displayId === "null") return; 

      if (!playersMap[displayId]) {
        playersMap[displayId] = {
          playerId: displayId,
          username: row.username || "-",
          country: row.country || "BR",
          registeredAt: null,
          ftdDate: null, 
          ftdAmount: 0,
          depositsCount: 0,
          withdrawals: 0,
          netPl: 0,
          volume: 0,
          qCpa: "Não"
        };
      }

      const p = playersMap[displayId];
      const currentDate = findDate(row);

      const regCount = findValue(row, ['registration_count', 'RegistrationCount']);
      const ftdCount = findValue(row, ['ftd_count', 'FtdCount']);
      const deposits = findValue(row, ['deposit_total', 'deposits']);
      const depCount = findValue(row, ['deposit_count']);
      const withdraw = findValue(row, ['withdrawal_total', 'withdrawals']);
      const pl = findValue(row, ['net_pl', 'net_pl_casino', 'net_pl_sport']);
      const vol = findValue(row, ['volume', 'turnover']); 

      if (currentDate) {
        if (regCount > 0) {
          if (!p.registeredAt || new Date(currentDate) < new Date(p.registeredAt)) {
            p.registeredAt = currentDate;
          }
        }
        if (ftdCount > 0) {
          if (!p.ftdDate || new Date(currentDate) < new Date(p.ftdDate)) {
            p.ftdDate = currentDate;
            if (p.ftdAmount === 0) p.ftdAmount = deposits || 10; 
          }
        }
      }

      p.depositsCount += depCount;
      p.withdrawals += withdraw;
      p.netPl += pl;
      p.volume += vol;

      if (p.ftdDate) p.qCpa = "Sim";
    });

    const list = Object.values(playersMap);
    const finalList = list.filter(p => p.registeredAt || p.ftdDate || p.netPl !== 0 || p.depositsCount > 0);

    finalList.sort((a,b) => {
        const da = new Date(a.registeredAt || a.ftdDate || 0);
        const db = new Date(b.registeredAt || b.ftdDate || 0);
        return db - da;
    });

    console.log(`   ✅ Relatório Reconstruído: ${finalList.length} jogadores.`);
    res.json({ players: finalList });

  } catch (error) {
    console.error("❌ Erro jogadores:", error.message);
    res.json({ players: [] });
  }
});

// =================================================================================
// ROTA 3: HISTÓRICO DE AFILIADO (GRÁFICOS CORRIGIDOS)
// =================================================================================
app.get("/api/affiliates/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;
    
    // Filtro específico para garantir que só vem dados deste ID
    const response = await axios.get(`${process.env.SMARTICO_BASE_URL}/api/af2_media_report_op`, {
      headers: { authorization: process.env.SMARTICO_API_KEY },
      params: { 
        aggregation_period: "DAY", 
        group_by: "day,affiliate_id", // Agrupa também por ID para evitar mistura
        filter_affiliate_id: id, 
        date_from, 
        date_to 
      }
    });
    
    const rawData = response.data.data || [];
    
    // --- AGREGAÇÃO POR DATA (A Correção) ---
    // A API pode mandar múltiplas linhas para o mesmo dia (ex: 1 linha pra BR, 1 pra PT).
    // O código anterior só mapeava, criando pontos duplicados no gráfico.
    // Aqui nós SOMAMOS tudo por dia.
    const dailyMap = {};

    rawData.forEach(item => {
      // Garante que é o afiliado certo
      if (String(item.affiliate_id) !== String(id)) return;

      const date = findDate(item);
      if (!date) return;

      if (!dailyMap[date]) {
        dailyMap[date] = { 
          name: date, 
          registrations: 0, ftds: 0, commission: 0, net_pnl: 0 
        };
      }

      dailyMap[date].registrations += findValue(item, ['registration_count', 'RegistrationCount']);
      dailyMap[date].ftds += findValue(item, ['ftd_count', 'FtdCount']);
      dailyMap[date].commission += findValue(item, ['commissions_total', 'CommissionsTotal']);
      dailyMap[date].net_pnl += findValue(item, ['net_pl', 'NetPL']);
    });

    // Converte o mapa de volta para lista e ordena por data
    const history = Object.values(dailyMap).sort((a, b) => new Date(a.name) - new Date(b.name));
    
    res.json({ history });
  } catch (e) { res.json({ history: [] }); }
});

// =================================================================================
// ROTA 4: HISTÓRICO GERAL (VISÃO GERAL CORRIGIDA)
// =================================================================================
app.get("/api/overview/history", async (req, res) => {
  try {
    const response = await axios.get(`${process.env.SMARTICO_BASE_URL}/api/af2_media_report_op`, {
      headers: { authorization: process.env.SMARTICO_API_KEY },
      params: { 
        aggregation_period: "DAY", 
        group_by: "day", 
        date_from: req.query.date_from, 
        date_to: req.query.date_to 
      }
    });
    
    const rawData = response.data.data || [];
    
    // --- AGREGAÇÃO GERAL ---
    const dailyMap = {};

    rawData.forEach(item => {
      // Ignora o afiliado default para não distorcer o gráfico geral
      if (item.affiliate_id === 468904) return;

      const date = findDate(item);
      if (!date) return;

      if (!dailyMap[date]) {
        dailyMap[date] = { 
          name: date, 
          registrations: 0, ftds: 0, commission: 0, net_pnl: 0 
        };
      }

      dailyMap[date].registrations += findValue(item, ['registration_count', 'RegistrationCount']);
      dailyMap[date].ftds += findValue(item, ['ftd_count', 'FtdCount']);
      dailyMap[date].commission += findValue(item, ['commissions_total', 'CommissionsTotal']);
      dailyMap[date].net_pnl += findValue(item, ['net_pl', 'NetPL']);
    });

    const history = Object.values(dailyMap).sort((a, b) => new Date(a.name) - new Date(b.name));
    
    res.json({ history });
  } catch (e) { res.json({ history: [] }); }
});

const PORT = 3333;
app.listen(PORT, () => console.log(`🚀 Backend (Com Gráficos Corrigidos) rodando em http://localhost:${PORT}`));