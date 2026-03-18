const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const rooms = new Map();

const HAND_SIZE_BY_PLAYERS = {
  2: 10,
  3: 9,
  4: 8,
  5: 7
};

const BASE_DECK = [
  ...Array(14).fill('tempura'),
  ...Array(14).fill('sashimi'),
  ...Array(14).fill('dumpling'),
  ...Array(6).fill('maki1'),
  ...Array(12).fill('maki2'),
  ...Array(8).fill('maki3'),
  ...Array(10).fill('salmon_nigiri'),
  ...Array(5).fill('squid_nigiri'),
  ...Array(5).fill('egg_nigiri'),
  ...Array(6).fill('wasabi'),
  ...Array(10).fill('pudding')
];

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function randomId(size = 8) {
  return crypto.randomBytes(size).toString('hex');
}

function roomCode() {
  return randomId(3).toUpperCase();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeDeck(playersCount) {
  const handSize = HAND_SIZE_BY_PLAYERS[playersCount];
  const cardsNeeded = handSize * playersCount;
  const all = shuffle([...BASE_DECK]);
  return all.slice(0, cardsNeeded);
}

function createRoom(hostName) {
  let code = roomCode();
  while (rooms.has(code)) {
    code = roomCode();
  }

  const host = {
    id: randomId(6),
    name: hostName,
    score: 0,
    puddings: 0,
    table: [],
    roundGain: 0
  };

  const room = {
    id: code,
    phase: 'lobby',
    hostId: host.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    round: 0,
    turn: 0,
    players: [host],
    hands: {},
    pendingPlays: {},
    winnerIds: [],
    message: 'Esperando jugadores...'
  };

  rooms.set(code, room);
  return { room, host };
}

function ensureRoom(req, res, id) {
  const room = rooms.get(id);
  if (!room) {
    json(res, 404, { error: 'Sala no encontrada' });
    return null;
  }
  return room;
}

function getPlayer(room, playerId) {
  return room.players.find(p => p.id === playerId);
}

function startGame(room) {
  const playersCount = room.players.length;
  room.phase = 'playing';
  room.round = 1;
  room.turn = 1;
  room.winnerIds = [];
  for (const p of room.players) {
    p.score = 0;
    p.puddings = 0;
    p.table = [];
    p.roundGain = 0;
  }
  dealRound(room, playersCount);
  room.message = 'Partida iniciada';
  room.updatedAt = Date.now();
}

function dealRound(room, playersCount) {
  const handSize = HAND_SIZE_BY_PLAYERS[playersCount];
  const deck = makeDeck(playersCount);
  room.hands = {};
  room.pendingPlays = {};

  for (const p of room.players) {
    p.table = [];
    p.roundGain = 0;
  }

  for (let i = 0; i < room.players.length; i++) {
    const player = room.players[i];
    room.hands[player.id] = deck.slice(i * handSize, (i + 1) * handSize);
  }
}

function resolveTurn(room) {
  const playerIds = room.players.map(p => p.id);

  for (const pid of playerIds) {
    const card = room.pendingPlays[pid];
    if (!card) {
      continue;
    }
    const player = getPlayer(room, pid);
    if (player) {
      player.table.push(card);
    }
  }

  room.pendingPlays = {};

  const oldHands = room.hands;
  const rotatedHands = {};

  for (let i = 0; i < room.players.length; i++) {
    const current = room.players[i];
    const from = room.players[(i - 1 + room.players.length) % room.players.length];
    rotatedHands[current.id] = oldHands[from.id] || [];
  }

  room.hands = rotatedHands;

  const handLeft = (room.hands[room.players[0].id] || []).length;
  if (handLeft === 0) {
    endRound(room);
    return;
  }

  room.turn += 1;
  room.updatedAt = Date.now();
}

function endRound(room) {
  scoreRound(room);

  if (room.round >= 3) {
    endGame(room);
    return;
  }

  room.round += 1;
  room.turn = 1;
  dealRound(room, room.players.length);
  room.message = `Ronda ${room.round}`;
  room.updatedAt = Date.now();
}

function countCards(cards) {
  const out = {};
  for (const c of cards) {
    out[c] = (out[c] || 0) + 1;
  }
  return out;
}

function scoreRound(room) {
  const maki = [];

  for (const p of room.players) {
    const counts = countCards(p.table);
    let score = 0;

    const tempuraPairs = Math.floor((counts.tempura || 0) / 2);
    score += tempuraPairs * 5;

    const sashimiTrios = Math.floor((counts.sashimi || 0) / 3);
    score += sashimiTrios * 10;

    const dumplings = Math.min(counts.dumpling || 0, 5);
    const dumplingScore = [0, 1, 3, 6, 10, 15][dumplings];
    score += dumplingScore;

    let wasabiOpen = 0;
    for (const card of p.table) {
      if (card === 'wasabi') {
        wasabiOpen += 1;
        continue;
      }
      const nigiriVal = card === 'egg_nigiri' ? 1 : card === 'salmon_nigiri' ? 2 : card === 'squid_nigiri' ? 3 : 0;
      if (nigiriVal === 0) {
        continue;
      }
      if (wasabiOpen > 0) {
        score += nigiriVal * 3;
        wasabiOpen -= 1;
      } else {
        score += nigiriVal;
      }
    }

    p.puddings += counts.pudding || 0;

    const makiTotal = (counts.maki1 || 0) + (counts.maki2 || 0) * 2 + (counts.maki3 || 0) * 3;
    maki.push({ playerId: p.id, total: makiTotal });

    p.score += score;
    p.roundGain = score;
  }

  scoreMaki(room, maki);
}

function scoreMaki(room, maki) {
  const sorted = [...maki].sort((a, b) => b.total - a.total);
  const max = sorted[0]?.total || 0;
  if (max <= 0) {
    return;
  }

  const first = sorted.filter(x => x.total === max);
  const firstPointsEach = Math.floor(6 / first.length);
  for (const f of first) {
    const player = getPlayer(room, f.playerId);
    if (player) {
      player.score += firstPointsEach;
      player.roundGain += firstPointsEach;
    }
  }

  if (first.length > 1) {
    return;
  }

  const secondValue = sorted.find(x => x.total < max)?.total || 0;
  if (secondValue <= 0) {
    return;
  }

  const second = sorted.filter(x => x.total === secondValue);
  const secondPointsEach = Math.floor(3 / second.length);
  for (const s of second) {
    const player = getPlayer(room, s.playerId);
    if (player) {
      player.score += secondPointsEach;
      player.roundGain += secondPointsEach;
    }
  }
}

function endGame(room) {
  scorePuddings(room);

  const maxScore = Math.max(...room.players.map(p => p.score));
  const leaders = room.players.filter(p => p.score === maxScore);
  if (leaders.length === 1) {
    room.winnerIds = [leaders[0].id];
  } else {
    const bestPudding = Math.max(...leaders.map(p => p.puddings));
    room.winnerIds = leaders.filter(p => p.puddings === bestPudding).map(p => p.id);
  }

  room.phase = 'finished';
  room.message = 'Partida finalizada';
  room.updatedAt = Date.now();
}

function scorePuddings(room) {
  const sorted = [...room.players].sort((a, b) => b.puddings - a.puddings);
  const max = sorted[0]?.puddings || 0;
  const min = sorted[sorted.length - 1]?.puddings || 0;

  if (max > 0) {
    const winners = sorted.filter(p => p.puddings === max);
    const points = Math.floor(6 / winners.length);
    for (const w of winners) {
      w.score += points;
    }
  }

  if (room.players.length > 2) {
    const losers = sorted.filter(p => p.puddings === min);
    const points = Math.floor(6 / losers.length);
    for (const l of losers) {
      l.score -= points;
    }
  }
}

function stateFor(room, playerId) {
  return {
    id: room.id,
    phase: room.phase,
    hostId: room.hostId,
    round: room.round,
    turn: room.turn,
    message: room.message,
    winnerIds: room.winnerIds,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      puddings: p.puddings,
      table: p.table,
      roundGain: p.roundGain,
      handCount: (room.hands[p.id] || []).length,
      playedThisTurn: Boolean(room.pendingPlays[p.id])
    })),
    hand: room.hands[playerId] || []
  };
}

function serveStatic(req, res) {
  let target = req.url === '/' ? '/index.html' : req.url;
  target = target.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, target);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.css'
      ? 'text/css; charset=utf-8'
      : ext === '.js'
      ? 'text/javascript; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/api/rooms') {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      if (!name) {
        json(res, 400, { error: 'Nombre requerido' });
        return;
      }
      const { room, host } = createRoom(name.slice(0, 24));
      json(res, 201, { roomId: room.id, playerId: host.id });
      return;
    }

    if (req.method === 'POST' && /^\/api\/rooms\/[^/]+\/join$/.test(url.pathname)) {
      const roomId = url.pathname.split('/')[3];
      const room = ensureRoom(req, res, roomId);
      if (!room) {
        return;
      }
      if (room.phase !== 'lobby') {
        json(res, 400, { error: 'La partida ya comenzó' });
        return;
      }
      if (room.players.length >= 5) {
        json(res, 400, { error: 'La sala está llena' });
        return;
      }

      const body = await parseBody(req);
      const name = String(body.name || '').trim().slice(0, 24);
      if (!name) {
        json(res, 400, { error: 'Nombre requerido' });
        return;
      }

      const player = {
        id: randomId(6),
        name,
        score: 0,
        puddings: 0,
        table: [],
        roundGain: 0
      };
      room.players.push(player);
      room.updatedAt = Date.now();
      json(res, 201, { roomId: room.id, playerId: player.id });
      return;
    }

    if (req.method === 'POST' && /^\/api\/rooms\/[^/]+\/start$/.test(url.pathname)) {
      const roomId = url.pathname.split('/')[3];
      const room = ensureRoom(req, res, roomId);
      if (!room) {
        return;
      }
      const body = await parseBody(req);
      const playerId = String(body.playerId || '');
      if (room.hostId !== playerId) {
        json(res, 403, { error: 'Solo el host puede iniciar' });
        return;
      }
      if (room.players.length < 2) {
        json(res, 400, { error: 'Se necesitan al menos 2 jugadores' });
        return;
      }
      if (room.phase !== 'lobby') {
        json(res, 400, { error: 'La partida ya está en curso' });
        return;
      }
      startGame(room);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && /^\/api\/rooms\/[^/]+\/play$/.test(url.pathname)) {
      const roomId = url.pathname.split('/')[3];
      const room = ensureRoom(req, res, roomId);
      if (!room) {
        return;
      }
      if (room.phase !== 'playing') {
        json(res, 400, { error: 'La partida no está activa' });
        return;
      }

      const body = await parseBody(req);
      const playerId = String(body.playerId || '');
      const cardId = String(body.cardId || '');
      const player = getPlayer(room, playerId);
      if (!player) {
        json(res, 403, { error: 'Jugador no válido' });
        return;
      }

      if (room.pendingPlays[playerId]) {
        json(res, 400, { error: 'Ya jugaste este turno' });
        return;
      }

      const hand = room.hands[playerId] || [];
      const idx = hand.indexOf(cardId);
      if (idx === -1) {
        json(res, 400, { error: 'Carta no disponible' });
        return;
      }

      hand.splice(idx, 1);
      room.pendingPlays[playerId] = cardId;
      room.updatedAt = Date.now();

      const allPlayed = room.players.every(p => Boolean(room.pendingPlays[p.id]));
      if (allPlayed) {
        resolveTurn(room);
      }

      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && /^\/api\/rooms\/[^/]+\/state$/.test(url.pathname)) {
      const roomId = url.pathname.split('/')[3];
      const room = ensureRoom(req, res, roomId);
      if (!room) {
        return;
      }
      const playerId = String(url.searchParams.get('playerId') || '');
      const player = getPlayer(room, playerId);
      if (!player) {
        json(res, 403, { error: 'Jugador no encontrado en la sala' });
        return;
      }
      json(res, 200, stateFor(room, playerId));
      return;
    }

    serveStatic(req, res);
  } catch (err) {
    json(res, 500, { error: err.message || 'Error interno' });
  }
});

server.listen(PORT, () => {
  console.log(`Sushi Go online corriendo en http://localhost:${PORT}`);
});
