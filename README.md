# EV Charge Tracker

Suivi de recharge pour véhicules électriques — PWA self-hosted.

## Stack

- **Backend** : Node.js + Express + SQLite (better-sqlite3)
- **Frontend** : React + Vite + Recharts (PWA)
- **Container** : Docker single-container, nginx-free

---

## Déploiement via Portainer (GitHub)

### 1. Pousser sur GitHub

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/TON_USER/ev-tracker.git
git push -u origin main
```

### 2. Portainer — Créer un Stack

- **Stacks → Add stack → Repository**
- Repository URL : `https://github.com/TON_USER/ev-tracker`
- Compose path : `docker-compose.yml`
- Cliquer **Deploy the stack**

### 3. Mapping volume (persistance DB)

Le fichier `docker-compose.yml` mappe `./data:/app/data`.  
Portainer crée le dossier `data/` à côté du stack — la DB SQLite `ev-tracker.db` y est stockée.

Pour spécifier un chemin absolu sur le host, modifier dans le compose :

```yaml
volumes:
  - /opt/ev-tracker/data:/app/data
```

### 4. Variable JWT_SECRET

⚠️ Changer la valeur dans `docker-compose.yml` avant le déploiement :

```yaml
environment:
  - JWT_SECRET=un-secret-long-et-aleatoire
```

---

## Développement local

```bash
# Backend
npm install
npm run dev:server

# Frontend (autre terminal)
cd client && npm install && npm run dev
```

Frontend : http://localhost:5173  
API : http://localhost:3080/api

---

## Structure

```
ev-tracker/
├── server/
│   ├── index.js      # Express API
│   ├── db.js         # SQLite setup
│   └── auth.js       # JWT
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js    # Appels API
│   │   ├── utils.js  # Stats, formatters
│   │   ├── components/
│   │   └── pages/
│   └── public/       # manifest.json, sw.js
├── data/             # SQLite DB (gitignored)
├── Dockerfile
└── docker-compose.yml
```

## Port

`3080` par défaut — modifiable dans `docker-compose.yml`.
