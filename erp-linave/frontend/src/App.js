import React from 'react';
import { useErp } from './context/ErpContext';
import Usuarios from './components/Usuarios';
import Clientes from './components/Clientes';
import Obras from './components/Obras'; // Onde gerimos o USV Traveller
import Financeiro from './components/Financeiro';

function App() {
  const { user } = useErp();
  const [activeTab, setActiveTab] = React.useState('dashboard');

  //if (!user) return <LoginScreen />; // Tela de login se não houver user

  return (
    <div className="erp-container">
      <aside className="sidebar">
        <h2>Linave ERP</h2>
        <nav>
          <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          {user.role === 'ADMIN' && <button onClick={() => setActiveTab('usuarios')}>Usuários</button>}
          <button onClick={() => setActiveTab('clientes')}>Clientes</button>
          <button onClick={() => setActiveTab('obras')}>Obras / USV</button>
          <button onClick={() => setActiveTab('financeiro')}>Financeiro</button>
        </nav>
      </aside>

      <main className="content">
        {activeTab === 'dashboard' && <ResumoGeral />}
        {activeTab === 'usuarios' && <Usuarios />}
        {activeTab === 'clientes' && <Clientes />}
        {activeTab === 'obras' && <Obras />}
        {activeTab === 'financeiro' && <Financeiro />}
      </main>
    </div>
  );
}