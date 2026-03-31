// src/components/DashboardStats.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';   // Make sure this path is correct
import '../App.css';

export default function DashboardStats() {
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [latestActions, setLatestActions] = useState<any[]>([]);

  const [positionsLoading, setPositionsLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(true);

  const [loadingStates, setLoadingStates] = useState({
    usdc: true,
  });
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Refs for detecting new items (slide-in animation)
  const prevPositionsRef = useRef<Set<string>>(new Set());
  const prevActionsRef = useRef<Set<string>>(new Set());

  // Calculate total PL from all open positions
  const totalProfitLoss = useMemo(() => {
    return openPositions.reduce((sum, pos) => sum + (pos.pl || 0), 0);
  }, [openPositions]);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    // USDC Balance
    const balanceRef = ref(db, 'dashboard/usdcBalance');
    const unsubscribeBalance = onValue(
      balanceRef,
      (snapshot) => {
        setUsdcBalance(snapshot.val());
        setLoadingStates((prev) => ({ ...prev, usdc: false }));
        setFirebaseError(null);
      },
      (err) => {
        console.error('Balance error:', err);
        setFirebaseError(err instanceof Error ? err.message : String(err));
        setLoadingStates((prev) => ({ ...prev, usdc: false }));
      }
    );
    unsubscribes.push(unsubscribeBalance);

    // Open Positions
    const positionsRef = ref(db, 'dashboard/openPositions');
    const unsubscribePositions = onValue(
      positionsRef,
      (snapshot) => {
        console.log('✅ Positions snapshot received:', snapshot.val());

        const positionsData: any[] = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const key = childSnapshot.key!;
            const pos = childSnapshot.val() || {};

            const quantity = Number(pos.quantity || 0);
            const entryPrice = Number(pos.entryPrice || 0);
            const currentPrice = Number(pos.currentPrice || 0);
            const timestamp = pos.timestamp || Date.now();

            const pl = quantity * (currentPrice - entryPrice);
            const positionValue = quantity * entryPrice;

            positionsData.push({
              id: key,
              name: pos.name || pos.symbol || 'Unknown',
              transaction: pos.transaction || null,
              quantity: quantity,
              entryPrice: entryPrice,
              positionValue: positionValue,
              currentPrice: currentPrice.toFixed(2),
              pl: pl,
              timestamp: timestamp,
            });
          });
        }

        positionsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const currentIds = new Set(positionsData.map((p) => p.id));
        const newIds = Array.from(currentIds).filter((id) => !prevPositionsRef.current.has(id));

        const enhancedPositions = positionsData.map((pos) => {
          let txDisplay = '—';
          let fullTxUrl = '';

          if (pos.transaction) {
            const tx = pos.transaction;
            txDisplay = tx.length > 8 
              ? tx.slice(0, 5) + '...' 
              : tx;

            fullTxUrl = `https://solscan.io/tx/${tx}`;
          }

          return {
            ...pos,
            isNew: newIds.includes(pos.id),
            entryPriceFormatted: pos.entryPrice.toFixed(2),
            positionValueFormatted: pos.positionValue.toFixed(2),
            txDisplay,
            fullTxUrl,
          };
        });

        setOpenPositions(enhancedPositions);
        prevPositionsRef.current = currentIds;
        setPositionsLoading(false);
      },
      (err) => {
        console.error('Positions error:', err);
        setFirebaseError(`Positions error: ${err}`);
        setPositionsLoading(false);
      }
    );
    unsubscribes.push(unsubscribePositions);

    // Latest Actions
    const actionsRef = ref(db, 'dashboard/actions');
    const unsubscribeActions = onValue(
      actionsRef,
      (snapshot) => {
        console.log('✅ Actions snapshot received:', snapshot.val());

        const actionsData: any[] = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const key = childSnapshot.key!;
            const action = childSnapshot.val() || {};

            // Skip internal Firebase keys
            if (['actionsLastHour', 'currentModel', 'lastUpdated', 'openPositions',
                 'profitLoss', 'usdcBalance'].includes(key)) {
              return;
            }

            const description = action?.description || action?.action || 'No description';

            actionsData.push({
              id: key,
              timestamp: action?.timestamp || Date.now(),
              time: action?.timestamp 
                ? new Date(action.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })
                : '—',
              description: description,
            });
          });
        }

        actionsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const newActionsList = actionsData.slice(0, 10);

        const currentIds = new Set(newActionsList.map((a) => a.id));
        const newIds = Array.from(currentIds).filter((id) => !prevActionsRef.current.has(id));

        const enhancedActions = newActionsList.map((action) => ({
          ...action,
          isNew: newIds.includes(action.id),
        }));

        setLatestActions(enhancedActions);
        prevActionsRef.current = currentIds;
        setActionsLoading(false);
      },
      (err) => {
        console.error('Actions error:', err);
        setFirebaseError(`Actions error: ${err}`);
        setActionsLoading(false);
      }
    );
    unsubscribes.push(unsubscribeActions);

    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  const isLoading = loadingStates.usdc || positionsLoading || actionsLoading;

  if (isLoading) {
    return <div className="pixel-text" style={{ color: '#7F00FF' }}>Loading dashboard...</div>;
  }

  if (firebaseError) {
    return <div className="pixel-text" style={{ color: '#FF4444' }}>Firebase Error: {firebaseError}</div>;
  }

  return (
    <div className="pixel-text" style={{ color: '#9e3dff' }}>
      <h2>ELLA LLM</h2>
      <p><br/></p>

      <p>
        USDC Balance:{' '}
        <strong className="values" style={{ fontFamily: "Roboto", color: "white" }}>
          {usdcBalance !== null ? `$${usdcBalance}` : '—'}
        </strong>
      </p>

      <p>
        Total Profit/Loss:{' '}
        <strong 
          className="values" 
          style={{ 
            fontFamily: "Roboto", 
            color: totalProfitLoss >= 0 ? '#27ae60' : '#e74c3c',
            fontWeight: 600 
          }}
        >
          ${totalProfitLoss.toFixed(2)}
        </strong>
      </p>

      <p><br/></p>

      {/* Open Positions Table */}
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Tx</th>
            <th>Position</th>
            <th>Entry</th>
            <th>Current Price</th>
            <th>PL</th>
          </tr>
        </thead>
        <tbody>
          {openPositions.length > 0 ? (
            openPositions.map((pos) => (
              <tr 
                key={pos.id} 
                className={`action-row ${pos.isNew ? 'new-item' : ''}`}
              >
                <td className="values">{pos.name}</td>
                
                {/* Tx as clickable Solscan link */}
                <td className="values" style={{ 
                  fontSize: '0.85em', 
                  color: '#777', 
                  fontFamily: 'monospace'
                }}>
                  {pos.fullTxUrl ? (
                    <a 
                      href={pos.fullTxUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#777', textDecoration: 'underline' }}
                    >
                      {pos.txDisplay}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>

                <td className="values">${pos.positionValueFormatted}</td>
                <td className="values">{pos.entryPriceFormatted}</td>
                <td className="values">{pos.currentPrice}</td>
                <td 
                  className="values" 
                  style={{ 
                    color: (pos.pl || 0) >= 0 ? '#27ae60' : '#e74c3c',
                    fontWeight: 600 
                  }}
                >
                  ${pos.pl.toFixed(2)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="values" style={{ textAlign: 'center' }}>
                No open positions
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p><br/></p>

      {/* Latest Actions Table - Added class for better targeting */}
      <table className="dashboard-table actions-table">
        <tbody>
          {latestActions.length > 0 ? (
            latestActions.map((action) => (
              <tr 
                key={action.id} 
                className={`action-row ${action.isNew ? 'new-item' : ''}`}
              >
                <td className="values time-cell">
                  {action.time}
                </td>
                <td className="values description-cell">
                  {action.description}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="values" style={{ textAlign: 'center' }}>
                No actions yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}