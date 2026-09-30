import React, { useState } from 'react'
import { MdStorage, MdSearch, MdDownload, MdFolder, MdInsertDriveFile, MdCheckCircle, MdCloudDownload } from 'react-icons/md'

const DATA_TIERS = {
  Raw: [
    { name: 'satellite/2024/06/14/SST_20240614.nc', size: '142 MB', status: 'available' },
    { name: 'satellite/2024/06/14/SSS_20240614.nc', size: '98 MB',  status: 'available' },
    { name: 'satellite/2024/06/14/SLA_20240614.nc', size: '55 MB',  status: 'available' },
    { name: 'argo/2024/06/14/argo_20240614.nc',     size: '12 MB',  status: 'available' },
    { name: 'reanalysis/2024/06/glorys_20240614.nc',size: '680 MB', status: 'available' },
    { name: 'era5/2024/06/era5_wind_20240614.nc',   size: '210 MB', status: 'available' },
  ],
  Processed: [
    { name: 'interpolated/2024/06/14/interpolated.nc',     size: '48 MB',  status: 'available' },
    { name: 'qc/2024/06/14/qc_data.nc',                   size: '22 MB',  status: 'available' },
    { name: 'tensors/2024/06/14/input_data.zarr/',         size: '195 MB', status: 'available' },
    { name: 'features/2024/06/sst_anomaly.nc',             size: '31 MB',  status: 'available' },
    { name: 'features/2024/06/wind_stress_curl_raw.nc',    size: '28 MB',  status: 'available' },
  ],
  'Model Output': [
    { name: 'output/2024/06/14/temp_3d.nc',           size: '320 MB', status: 'available' },
    { name: 'output/2024/06/14/temp_2d_maps.nc',      size: '45 MB',  status: 'available' },
    { name: 'output/2024/06/14/temp_profiles.nc',     size: '8 MB',   status: 'available' },
    { name: 'output/2024/06/14/eof_coeffs.nc',        size: '14 MB',  status: 'available' },
    { name: 'output/2024/06/14/uncertainty_sigma.nc', size: '14 MB',  status: 'available' },
  ],
}

const PROVENANCE_CHAIN = [
  { step: 1, label: 'CMEMS Download',    output: 'SST_raw.nc',        tool: 'motu-client' },
  { step: 2, label: 'Regrid 0.25°',      output: 'SST_0p25.nc',       tool: 'xesmf.Regridder' },
  { step: 3, label: 'Climatology Fit',   output: 'SST_climo.npy',     tool: 'climatology_anomaly.py' },
  { step: 4, label: 'Anomaly Compute',   output: 'SST_anomaly.nc',    tool: 'climatology_anomaly.py' },
  { step: 5, label: 'Z-score Normalize', output: 'SST_std (Zarr)',    tool: 'standardize_and_zarr.py' },
  { step: 6, label: 'Model Inference',   output: 'temp_3d.nc',        tool: 'OceanNetHybrid.forward()' },
]

export default function DataCatalog() {
  const [activeTier, setActiveTier] = useState('Raw')
  const [search, setSearch] = useState('')

  const files = (DATA_TIERS[activeTier] || []).filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-container scroll-area">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-md">
            
            <h1 className="page-title">Data Lake Catalog & Provenance</h1>
          </div>
          <div className="page-subtitle">
            Tiered data lake · NetCDF lineage · Automated export · PostgreSQL catalog
          </div>
        </div>
        <div className="flex items-center gap-md">
          <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>SQLite Connected · v0.3-proto</span>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="grid-3 mb-xl">
        {[
          { label: 'Raw Data',      size: '195 GB',  files: '8,241', color: '#38bdf8' },
          { label: 'Processed',     size: '21.3 GB', files: '14,890', color: '#38bdf8' },
          { label: 'Model Outputs', size: '2.3 GB',  files: '2,103', color: '#38bdf8' },
        ].map(t => (
          <div key={t.label} className="glass-card metric-card" style={{ borderTop: `2px solid ${t.color}`, padding: '16px 20px' }}>
            <div className="metric-label" style={{ fontSize: 17 }}>{t.label}</div>
            <div className="metric-value" style={{ color: t.color, fontSize: 37 }}>{t.size}</div>
            <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>{t.files} files</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-xl)', alignItems: 'start' }}>
        {/* File Browser */}
        <div>
          <div className="glass-card p-md mb-xl">
            {/* Tier tabs + search */}
            <div className="flex items-center justify-between mb-md">
              <div className="tab-bar" style={{ flex: 0 }}>
                {Object.keys(DATA_TIERS).map(t => (
                  <button key={t} id={`tier-${t.replace(/\s+/g,'-').toLowerCase()}`}
                    className={`tab-item ${activeTier === t ? 'active' : ''}`}
                    onClick={() => setActiveTier(t)} style={{ fontSize: 17, padding: '8px 16px' }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-sm" style={{ position: 'relative' }}>
                <MdSearch size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
                <input id="catalog-search"
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search files…"
                  className="input-field" style={{ width: 260, paddingLeft: 34, fontSize: 17 }}
                />
              </div>
            </div>

            {/* File list */}
            <table className="data-table">
              <thead>
                <tr><th>File Path</th><th>Size</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-sm">
                        
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>{f.name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)' }}>{f.size}</td>
                    <td><span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 14, fontWeight: 700 }}>{f.status}</span></td>
                    <td>
                      <button id={`dl-${i}`} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 15 }}>
                         Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Provenance chain */}
          <div className="glass-card p-md">
            <div className="section-title mb-md" style={{ fontSize: 21 }}>Data Provenance & Lineage — SST Example</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {PROVENANCE_CHAIN.map((p, i) => (
                <div key={p.step} style={{ display: 'flex', alignItems: 'stretch', gap: 18 }}>
                  {/* Step indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'var(--cyan-ghost)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800, color: '#0369a1',
                    }}>{p.step}</div>
                    {i < PROVENANCE_CHAIN.length - 1 && (
                      <div style={{ width: 1, flex: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ paddingBottom: 20 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                    <div style={{ fontSize: 16, color: 'var(--text-muted)', marginTop: 3 }}>
                      Output: <span className="code-inline" style={{ fontSize: 16 }}>{p.output}</span>
                      &nbsp;·&nbsp;Tool: <span className="code-inline" style={{ fontSize: 16 }}>{p.tool}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Metadata + Export */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Catalog search filters */}
          <div className="glass-card p-md">
            <div className="section-title mb-md" style={{ fontSize: 21 }}>Discovery Filters</div>
            {[
              { label: 'Date Range',   placeholder: '2024-06-01 → 2024-06-14' },
              { label: 'Bounding Box', placeholder: '5°N-30°N, 45°E-105°E' },
              { label: 'Variable',     placeholder: 'temperature, sst, eof…' },
              { label: 'QC Flag',      placeholder: '>= 1 (good)' },
            ].map(f => (
              <div key={f.label} className="input-group mb-sm">
                <label className="input-label" style={{ fontSize: 16 }}>{f.label}</label>
                <input className="input-field" style={{ fontSize: 17, padding: '10px 14px' }} placeholder={f.placeholder} />
              </div>
            ))}
            <button id="catalog-search-btn" className="btn btn-primary" style={{ width: '100%', marginTop: 10, fontSize: 17, padding: '10px 16px' }}>
              <MdSearch size={18} /> Search Catalog
            </button>
          </div>

          {/* Export widget */}
          <div className="glass-card p-md">
            <div className="section-title mb-md" style={{ fontSize: 21 }}>
              <MdCloudDownload size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Export & Download
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { fmt: 'NetCDF-4', desc: 'Full 3D temperature + σ cube', color: '#0369a1' },
                { fmt: 'CSV',      desc: 'Point profiles, ARGO comparison', color: '#0369a1' },
                { fmt: 'GeoJSON',  desc: 'Heatwave polygons, ARGO tracks', color: '#0369a1' },
                { fmt: 'PDF Report', desc: 'Automated oceanographic summary', color: '#0369a1' },
              ].map(({ fmt, desc, color }) => (
                <button key={fmt} id={`export-${fmt.toLowerCase().replace(/[\s-]+/g,'-')}`}
                  className="btn btn-ghost" style={{ justifyContent: 'flex-start', gap: 14, height: 56, padding: '8px 16px' }}>
                  <MdDownload size={20} color={color} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color }}>{fmt}</div>
                    <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Archive status */}
          <div className="glass-card p-md">
            <div className="section-title mb-md" style={{ fontSize: 21 }}>Archival Status</div>
            {[
              { label: 'Daily Backup',    status: '✓ Complete', color: '#0369a1' },
              { label: 'Object Versioning', status: '✓ Active',   color: '#0369a1' },
              { label: 'Cold Storage',    status: 'Pending',    color: '#0369a1' },
              { label: 'Replication',     status: 'Local only', color: 'var(--text-muted)' },
            ].map(({ label, status, color }) => (
              <div key={label} className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 16, color, fontWeight: 700 }}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
