#!/usr/bin/env node
/*
 * Faux serveur Ollama pour les tests de bout en bout et les captures d'écran.
 * Écoute sur 127.0.0.1:11434, répond à /api/tags et /api/chat avec des traductions
 * préparées à la main (tools/demo/translations.<langue>.json). Aucun vrai modèle.
 * Un texte inconnu est renvoyé tel quel et noté dans tools/demo/unknown.txt.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'demo');
const dicts = {};
for (const f of fs.readdirSync(dir)) {
  const m = f.match(/^translations\.(\w+)\.json$/);
  if (m) dicts[m[1]] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
}
const LANG = { français: 'fr', russe: 'ru' };
const unknown = new Set();

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'demo-model:latest' }] }));
    if (req.url === '/api/chat') {
      const b = JSON.parse(body);
      const user = JSON.parse(b.messages[1].content);
      const d = dicts[LANG[user.target]] || {};
      const translations = user.texts.map((t) => {
        if (d[t]) return d[t];
        unknown.add(t);
        fs.writeFileSync(path.join(dir, 'unknown.txt'), [...unknown].join('\n') + '\n');
        return t.replace(/\{(\d+)\|[^{}]*\}/g, '{$1}');
      });
      return setTimeout(() => res.end(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify({ translations }) } })), Number(process.env.FAKE_OLLAMA_DELAY || 250));
    }
    res.statusCode = 404;
    res.end('{}');
  });
}).listen(11434, '127.0.0.1', () => console.log('fake ollama on 11434'));
