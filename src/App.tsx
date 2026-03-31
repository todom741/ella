// src/App.tsx
import './App.css';
import DashboardStats from './components/DashboardStats';

function App() {
  return (
    <div className="App">
      <div className="dashboard-container">
        <DashboardStats />
      </div>
    </div>
  );
}

export default App;