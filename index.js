// ============================================================
//  server.js — Servidor WebSocket LAN para CopperCube 6
//  Rode com: node server.js
//  Requer: npm install ws
// ============================================================

const WebSocket = require("ws");

const PORT = 8765;
const wss  = new WebSocket.Server({ port: PORT });

let players = {}; // { id: { ws, isHost, x, y, z, rotY } }
let nextId  = 1;

console.log(`[SERVER] Servidor LAN rodando na porta ${PORT}`);
console.log(`[SERVER] Aguardando jogadores...`);

wss.on("connection", function(ws) {

    const id = String(nextId++);
    console.log(`[SERVER] Novo cliente conectado: ID ${id}`);

    ws.on("message", function(raw) {
        let msg;
        try { msg = JSON.parse(raw); }
        catch(e) { return; }

        switch(msg.type) {

            // Jogador entrou
            case "join":
                players[id] = { ws, isHost: msg.isHost, x: 0, y: 0, z: 0, rotY: 0 };

                // Manda ID para o novo cliente
                ws.send(JSON.stringify({ type: "welcome", id }));

                // Manda lista dos jogadores já conectados para o novo
                const currentPlayers = Object.entries(players)
                    .filter(([pid]) => pid !== id)
                    .map(([pid, p]) => ({ id: pid, x: p.x, y: p.y, z: p.z }));

                ws.send(JSON.stringify({ type: "player_list", players: currentPlayers }));

                // Avisa os outros que este jogador entrou
                broadcast(id, { type: "player_joined", id, x: 0, y: 0, z: 0 });

                console.log(`[SERVER] Player ${id} (${msg.isHost ? "HOST" : "JOIN"}) entrou. Total: ${Object.keys(players).length}`);
                break;

            // Jogador moveu
            case "move":
                if (!players[id]) break;
                players[id].x    = msg.x;
                players[id].y    = msg.y;
                players[id].z    = msg.z;
                players[id].rotY = msg.rotY || 0;

                // Repassa para todos os outros
                broadcast(id, { type: "player_move", id, x: msg.x, y: msg.y, z: msg.z, rotY: msg.rotY || 0 });
                break;
        }
    });

    ws.on("close", function() {
        delete players[id];
        broadcast(id, { type: "player_left", id });
        console.log(`[SERVER] Player ${id} desconectou. Total: ${Object.keys(players).length}`);
    });

    ws.on("error", function(e) {
        console.error(`[SERVER] Erro no cliente ${id}:`, e.message);
    });
});

// Envia mensagem para todos exceto o remetente
function broadcast(senderId, msg) {
    const data = JSON.stringify(msg);
    for (const [id, p] of Object.entries(players)) {
        if (id !== senderId && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(data);
        }
    }
}
