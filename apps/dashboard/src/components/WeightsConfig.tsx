'use client';

import { useVault } from '../context/VaultContext';
import { useWallet } from '../context/WalletContext';

export function WeightsConfig() {
  const { investorWeights, config } = useVault();
  const { address } = useWallet();

  return (
    <section className="weights-section" aria-label="Administrator-assigned weight share configurations">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DISTRIBUTION GOVERNANCE</p>
          <h2>Administrator-Assigned Share Weights</h2>
          <p className="section-subtext">
            Configured share weights govern proportional streaming reward distribution across registered investor accounts.
          </p>
        </div>
        <div className="admin-status-pill">
          <span className="pill-dot" />
          <span>ADMIN: {config?.admin ? `${config.admin.slice(0, 5)}…${config.admin.slice(-5)}` : 'GDJ3K…ADMIN'}</span>
        </div>
      </div>

      <div className="weights-card">
        <table className="weights-table">
          <thead>
            <tr>
              <th scope="col">INVESTOR ACCOUNT</th>
              <th scope="col">ROLE / STATUS</th>
              <th scope="col" className="text-right">WEIGHT SHARES</th>
              <th scope="col" className="text-right">POOL ALLOCATION</th>
            </tr>
          </thead>
          <tbody>
            {investorWeights.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  No investor share weights currently recorded on-chain for this vault. Connect an authorized administrator wallet to assign weights in the console below.
                </td>
              </tr>
            ) : (
              investorWeights.map((entry, idx) => {
                const isConnectedUser = address && (entry.address.toLowerCase() === address.toLowerCase() || entry.address.startsWith(address.slice(0, 5)));
                const isAdmin = config?.admin && entry.address.toLowerCase() === config.admin.toLowerCase();

                return (
                  <tr key={`${entry.address}-${idx}`} className={isConnectedUser ? 'row-highlight' : ''}>
                    <td>
                      <div className="investor-cell">
                        <span className="investor-idx">#{String(idx + 1).padStart(2, '0')}</span>
                        <code className="address-code" title={entry.address}>
                          {entry.address.length > 16
                            ? `${entry.address.slice(0, 8)}…${entry.address.slice(-8)}`
                            : entry.address}
                        </code>
                      </div>
                    </td>
                    <td>
                      <div className="badge-group">
                        {isAdmin && <span className="role-badge badge-admin">ADMIN</span>}
                        {isConnectedUser && <span className="role-badge badge-you">YOUR WALLET</span>}
                        {!isAdmin && !isConnectedUser && <span className="role-badge badge-investor">INVESTOR</span>}
                      </div>
                    </td>
                    <td className="text-right">
                      <span className="shares-value">{entry.shares.toLocaleString()}</span>
                    </td>
                    <td className="text-right">
                      <div className="percent-cell">
                        <span className="percent-number">{entry.percent.toFixed(1)}%</span>
                        <div className="percent-bar-bg">
                          <div
                            className="percent-bar-fill"
                            style={{ width: `${Math.min(100, entry.percent)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
