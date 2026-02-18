# InventoryPro

Inventory management system with multi-franchise support, sales tracking, and reporting.

## Project Structure

```
Inventory/
├── client/          # Frontend (React + Vite)
├── server/          # Backend (Node.js + Express)
├── docs/            # Documentation & implementation notes
└── README.md
```

## Deployment

### Backend
```bash
cd server
npm install
npm start
```
Set environment variables (e.g. in `.env`): `PORT`, `MONGODB_URI`, `JWT_SECRET`, etc.

### Frontend
```bash
cd client
npm install
npm run build
```
Serve the `client/dist` output with a static server or reverse proxy.

### Documentation
See [docs/README.md](./docs/README.md) for implementation notes and guides.
