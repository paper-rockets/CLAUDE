const fs = require('fs');
const code = fs.readFileSync('src/main.js', 'utf8');
const lines = code.split('\n');
let stack = [];
let inStr = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inLineComment = false;
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const next = line[j+1];
        if (inLineComment) continue;
        if (!inStr && char === '/' && next === '/') { inLineComment = true; break; }
        if (inStr) {
            if (inStr === '`') {
                if (char === '`' && line[j-1] !== '\\') inStr = null;
                continue;
            }
            if (char === inStr && line[j-1] !== '\\') inStr = null;
            continue;
        }
        if (char === '\'' || char === '"' || char === '`') { inStr = char; continue; }
        if (char === '{') stack.push({ line: i + 1, text: line.trim() });
        else if (char === '}') {
            if (stack.length === 0) console.log('Extra closing brace at line', i + 1);
            else stack.pop();
        }
    }
}
console.log('Unclosed braces count:', stack.length);
if (stack.length > 0) {
    console.log('Unclosed braces:');
    stack.forEach(b => console.log('Line ' + b.line + ': ' + b.text));
}
