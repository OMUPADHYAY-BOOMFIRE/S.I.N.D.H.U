const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Replace :root variables
css = css.replace(/:root\s*\{[\s\S]*?\/\*\s*Spacing\s*\*\//, `:root {
  /* Backgrounds: Deep Ocean Dark Theme */
  --bg-primary:      #020617;
  --bg-surface:      #0f172a;
  --bg-elevated:     #1e293b;
  --bg-card:         rgba(15, 23, 42, 0.75);
  --bg-card-hover:   rgba(30, 41, 59, 0.85);
  --bg-overlay:      rgba(2, 6, 23, 0.90);

  /* Deep Ocean Spectrum */
  --ocean-sun:       #38bdf8;
  --ocean-azure:     #0ea5e9;
  --ocean-vibrant:   #0284c7;
  --ocean-royal:     #0369a1;
  --ocean-cerulean:  #075985;
  --ocean-sapphire:  #0c4a6e;
  --ocean-deep:      #1e3a8a;
  --ocean-abyss:     #172554;

  /* Accents */
  --cyan:            #38bdf8;
  --cyan-bright:     #7dd3fc;
  --cyan-dim:        rgba(56, 189, 248, 0.2);
  --cyan-ghost:      rgba(56, 189, 248, 0.1);
  --blue:            #60a5fa;
  --blue-vivid:      #93c5fd;
  --blue-deep:       #2563eb;
  --blue-ghost:      rgba(96, 165, 250, 0.1);
  --orange:          #fb923c;
  --orange-ghost:    rgba(251, 146, 60, 0.12);
  --green:           #34d399;
  --green-ghost:     rgba(52, 211, 153, 0.12);
  --purple:          #c084fc;
  --warning:         #fbbf24;
  --danger:          #f87171;
  --danger-ghost:    rgba(248, 113, 113, 0.12);

  /* Text - Crisp high-contrast */
  --text-primary:    #f8fafc;
  --text-secondary:  #cbd5e1;
  --text-muted:      #94a3b8;
  --text-accent:     #38bdf8;

  /* Borders — Luminous soft cyan */
  --border:         rgba(56, 189, 248, 0.2);
  --border-strong:  rgba(56, 189, 248, 0.4);
  --border-subtle:  rgba(255, 255, 255, 0.05);

  /* Shadows & Glows */
  --glow-cyan:    0 0 20px rgba(56, 189, 248, 0.25);
  --glow-sm:      0 0 10px rgba(56, 189, 248, 0.15);
  --shadow-card:  0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg:    0 20px 48px -6px rgba(0, 0, 0, 0.7), 0 0 24px rgba(56, 189, 248, 0.1);

  /* Spacing */`);

// 2. Replace body background
css = css.replace(/background:\s*radial-gradient[^;]+;/, 'background: radial-gradient(circle at 50% -10%, #0c4a6e 0%, #075985 30%, #0369a1 60%, #020617 100%);');

// 3. Glass card backgrounds
css = css.replace(/\.glass-card\s*\{[\s\S]*?\}/, `.glass-card {
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
}`);

css = css.replace(/\.glass-card-elevated\s*\{[\s\S]*?\}/, `.glass-card-elevated {
  background: rgba(30, 41, 59, 0.75);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  color: var(--text-primary);
}`);

// 4. Metric Card backgrounds and text colors
css = css.replace(/\.metric-card\s*\{[\s\S]*?\}/, `.metric-card {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  position: relative;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(16px);
}`);

css = css.replace(/\.metric-label\s*\{[\s\S]*?\}/, `.metric-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}`);

css = css.replace(/\.metric-value\s*\{[\s\S]*?\}/, `.metric-value {
  font-size: 38px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}`);

css = css.replace(/\.metric-unit\s*\{[\s\S]*?\}/, `.metric-unit {
  font-size: 18px;
  font-weight: 600;
  color: var(--cyan);
  margin-left: 5px;
}`);

// 5. Page Title
css = css.replace(/\.page-title\s*\{[\s\S]*?\}/, `.page-title {
  font-size: 32px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}`);

css = css.replace(/\.page-subtitle\s*\{[\s\S]*?\}/, `.page-subtitle {
  font-size: 18px;
  color: var(--cyan-bright);
  margin-top: 4px;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
}`);

// 6. Chart Tooltip fixes
css = css.replace(/\.recharts-default-tooltip\s*\{[\s\S]*?\}/, `.recharts-default-tooltip {
  background: rgba(15, 23, 42, 0.9) !important;
  backdrop-filter: blur(10px) !important;
  border: 1.5px solid var(--border-strong) !important;
  border-radius: 12px !important;
  box-shadow: var(--shadow-lg) !important;
  color: var(--text-primary) !important;
}`);

css = css.replace(/\.recharts-tooltip-label\s*\{[\s\S]*?\}/, `.recharts-tooltip-label {
  color: var(--text-secondary) !important;
  font-weight: 700 !important;
}`);

css = css.replace(/\.recharts-tooltip-item\s*\{[\s\S]*?\}/, `.recharts-tooltip-item {
  color: var(--cyan-bright) !important;
  font-weight: 800 !important;
}`);

css = css.replace(/\.recharts-cartesian-grid line\s*\{[\s\S]*?\}/, `.recharts-cartesian-grid line {
  stroke: var(--border-subtle) !important;
}`);

css = css.replace(/\.recharts-text,\s*\.recharts-cartesian-axis-tick text\s*\{[\s\S]*?\}/, `.recharts-text,
.recharts-cartesian-axis-tick text {
  fill: var(--text-secondary) !important;
  font-weight: 600 !important;
}`);

fs.writeFileSync(cssPath, css);
console.log('Successfully updated index.css to Dark Theme!');
