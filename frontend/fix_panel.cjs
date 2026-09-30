const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'src', 'components', 'HoverExpandablePanel.jsx');
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(/border:\s*isExpanded \? '[^']+' : '[^']+',/, `border: isExpanded ? '1px solid var(--border-strong)' : '1px solid var(--border)',`);
content = content.replace(/background:\s*isExpanded[^:]+:[^,]+,/, `background: isExpanded ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)',`);
content = content.replace(/boxShadow:\s*isExpanded[^:]+:[^,]+,/, `boxShadow: isExpanded ? 'var(--shadow-lg)' : 'var(--shadow-card)',`);
content = content.replace(/color:\s*'#0f172a',/g, `color: 'var(--text-primary)',`);

content = content.replace(/borderBottom:\s*isExpanded \? '[^']+' : 'none',/, `borderBottom: isExpanded ? '1px solid var(--border)' : 'none',`);
content = content.replace(/background:\s*isExpanded \? 'rgba[^']+' : 'transparent',/, `background: isExpanded ? 'rgba(2, 6, 23, 0.4)' : 'transparent',`);

content = content.replace(/background:\s*'#e0f2fe',/, `background: 'rgba(56, 189, 248, 0.1)',`);
content = content.replace(/border:\s*'1px solid #bae6fd',/, `border: '1px solid var(--border)',`);
content = content.replace(/color:\s*'#0284c7'/g, `color: 'var(--cyan)'`);

content = content.replace(/color:\s*'#64748b'/g, `color: 'var(--text-muted)'`);
content = content.replace(/color:\s*'#475569'/g, `color: 'var(--text-secondary)'`);

content = content.replace(/background:\s*'#f1f5f9'/g, `background: 'rgba(255, 255, 255, 0.05)'`);
content = content.replace(/background:\s*'#e2e8f0'/g, `background: 'rgba(255, 255, 255, 0.1)'`);

fs.writeFileSync(filepath, content);
console.log('Fixed HoverExpandablePanel styles');
