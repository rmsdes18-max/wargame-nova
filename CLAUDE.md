# Wargame Nova

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
