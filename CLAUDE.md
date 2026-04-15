# Wargame Nova

## VERSIONING
- Verifica VERSION.md pentru versiunea curenta
- Actualizeaza CHANGELOG.md dupa fiecare modificare majora
- Marcheaza ce ai facut si ce urmeaza in "Next"

## CODE STYLE - OBLIGATORIU

Toate modificarile de cod JS TREBUIE sa respecte aceste reguli. Verifica INTOTDEAUNA inainte de a scrie cod.

### Reguli stricte:
- `var` (NU const/let)
- `function` declarations (NU arrow functions)
- Single quotes `'text'` (NU backticks/template literals)
- String concatenation `'Hello ' + name` (NU template literals)
- Semicolons obligatorii
- 2 spaces indentation
- Parametri: `options` sau `opts`

### JSDoc format:
```javascript
/**
 * FunctionName - Descriere scurta
 * @param {string} param1 - Descriere
 * @param {object} [options] - Optiuni
 * @returns {string} HTML string
 */
```

### Section headers:
```javascript
/* ── Section Name ── */
```

### Exemplu CORECT:
```javascript
function MyComponent(data, options) {
  var opts = options || {};
  var html = '';
  html += '<div class="item">';
  html += data.name;
  html += '</div>';
  return html;
}
```

### Exemplu GRESIT (NU folosi):
```javascript
const MyComponent = (data, config) => {
  let html = `<div class="item">${data.name}</div>`;
  return html
}
```

### Referinta:
Cand nu esti sigur, uita-te la `public/js/components/role-badge.js` ca model.

## Permissions

- NEVER ask for permission to read, write, or modify files in this repo
- NEVER ask for permission to run git commands (add, commit, push)
- NEVER ask for permission to run shell commands (npm, node, kill, lsof)
- NEVER ask "should I proceed?" or "shall I continue?" — just DO IT
- Deploy command: git add -A && git commit -m "message" && git push
- If localhost:3000 doesn't work, deploy direct and test on https://wartl-app.com
- Auto-deploy via Coolify on push to main, ~90 sec delay
