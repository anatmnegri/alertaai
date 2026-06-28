import { useState, useRef, useEffect } from 'react'
import Sidebar    from '../components/Sidebar'
import Header     from '../components/Header'
import MapCard    from '../components/MapCard'
import BarChartCard  from '../components/BarChartCard'
import PieChartCard  from '../components/PieChartCard'
import ChamadosTable from '../components/ChamadosTable'
import RightPanel    from '../components/RightPanel'
import ChamadosPage  from './ChamadosPage'
import PrevisoesApacPage from './PrevisoesApacPage'
import ChamadoModal  from '../components/ChamadoModal'
import { fetchOcorrencias, mapearOcorrencia } from '../services/api'
import * as signalR from '@microsoft/signalr'

export default function Painel() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [chamados, setChamados] = useState([])
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null)
  const mainRef = useRef(null)

  useEffect(() => {
    fetchOcorrencias()
      .then(setChamados)
      .catch(err => console.error('Erro ao carregar ocorrências:', err))

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5019/hubs/emergency')
      .withAutomaticReconnect()
      .build()

    connection.on('NewOccurrence', (ocorrencia) => {
      setChamados(prev => [mapearOcorrencia(ocorrencia), ...prev])
    })

    connection.start().catch(err => console.error('SignalR erro:', err))

    return () => connection.stop()
  }, [])

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [activePage])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f0f2f5]">
      <Sidebar active={activePage} onNavigate={setActivePage} />

      <main ref={mainRef} className="flex-1 overflow-y-auto">
        {activePage === 'Dashboard' && (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>
            <Header />
            <MapCard
              chamados={chamados}
              onChamadoSelect={setChamadoSelecionado}
            />
            <div className="flex gap-5">
              <BarChartCard />
              <PieChartCard chamados={chamados} />
            </div>
            <ChamadosTable chamados={chamados} onVerTudo={() => setActivePage('Chamados')} />
          </div>
        )}

        {activePage === 'Chamados' && <ChamadosPage chamados={chamados} onChamadosChange={setChamados} />}

        {activePage === 'Previsões da APAC' && <PrevisoesApacPage />}
      </main>

      <RightPanel />

      {chamadoSelecionado && (
        <ChamadoModal
          chamado={chamadoSelecionado}
          onClose={() => setChamadoSelecionado(null)}
        />
      )}
    </div>
  )
}
