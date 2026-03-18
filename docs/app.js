const STORAGE_KEY = 'sushi_go_scoreboard_v2';
const PLAYER_OPTIONS = [2, 3, 4, 5];
const TOTAL_ROUNDS = 3;
const CARDS_PER_PLAYER = {
  2: 10,
  3: 9,
  4: 8,
  5: 7
};

const CARD_DEFS = {
  maki1: {
    label: 'Maki 1',
    kind: 'maki',
    maki: 1,
    asset: './assets/Maki1.jpeg',
    aliases: ['maki1', 'maki 1', 'maki x1', 'maki uno']
  },
  maki2: {
    label: 'Maki 2',
    kind: 'maki',
    maki: 2,
    asset: './assets/Maki2.jpeg',
    aliases: ['maki2', 'maki 2', 'maki x2', 'maki dos']
  },
  maki3: {
    label: 'Maki 3',
    kind: 'maki',
    maki: 3,
    asset: './assets/Maki3.jpeg',
    aliases: ['maki3', 'maki 3', 'maki x3', 'maki tres']
  },
  chopsticks: {
    label: 'Palillos',
    kind: 'utility',
    asset: './assets/Palillos.jpeg',
    aliases: ['palillos', 'chopsticks']
  },
  tempura: {
    label: 'Tempura',
    kind: 'set',
    asset: './assets/Tempura.jpeg',
    aliases: ['tempura']
  },
  sashimi: {
    label: 'Sashimi',
    kind: 'set',
    asset: './assets/Sashimi.jpeg',
    aliases: ['sashimi']
  },
  gyoza: {
    label: 'Gyoza',
    kind: 'set',
    asset: './assets/Gyoza.jpeg',
    aliases: ['gyoza']
  },
  wasabi: {
    label: 'Wasabi',
    kind: 'wasabi',
    asset: './assets/Wasabi.jpeg',
    aliases: ['wasabi']
  },
  nigiri_egg: {
    label: 'Nigiri de tortilla',
    kind: 'nigiri',
    nigiri: 1,
    asset: './assets/Niguiri huevo.jpeg',
    aliases: ['nigiri de tortilla', 'nigiri tortilla', 'nigiri huevo', 'nigiri egg', 'tortilla', 'huevo']
  },
  nigiri_salmon: {
    label: 'Nigiri de salmon',
    kind: 'nigiri',
    nigiri: 2,
    asset: './assets/Niguiri Salmon.jpeg',
    aliases: ['nigiri de salmon', 'nigiri salmon', 'salmon', 'salmon']
  },
  nigiri_squid: {
    label: 'Nigiri de calamar',
    kind: 'nigiri',
    nigiri: 3,
    asset: './assets/Niguiri.jpeg',
    aliases: ['nigiri de calamar', 'nigiri calamar', 'calamar', 'squid']
  },
  pudding: {
    label: 'Pudin',
    kind: 'dessert',
    asset: './assets/Postre.jpeg',
    aliases: ['pudin', 'pudding', 'postre', 'postres']
  }
};

const GYOZA_SCORES = [0, 1, 3, 6, 10, 15];
const CARD_ORDER = [
  'maki1',
  'maki2',
  'maki3',
  'tempura',
  'sashimi',
  'gyoza',
  'wasabi',
  'nigiri_egg',
  'nigiri_salmon',
  'nigiri_squid',
  'chopsticks',
  'pudding'
];
const state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return createInitialState();
}

function createInitialState() {
  return {
    screen: 'landing',
    playerCount: 2,
    players: [],
    scoringRound: null,
    winnerIds: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildPlayers(names) {
  return names.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
    roundCards: Array.from({ length: TOTAL_ROUNDS }, () => []),
    roundScores: Array(TOTAL_ROUNDS).fill(0),
    roundNotes: Array(TOTAL_ROUNDS).fill(''),
    roundSource: Array(TOTAL_ROUNDS).fill(''),
    photos: Array(TOTAL_ROUNDS).fill(null),
    puddings: 0,
    puddingScore: 0,
    subtotal: 0,
    total: 0
  }));
}

function countCards(cards) {
  const counts = {};
  for (const cardId of cards) {
    counts[cardId] = (counts[cardId] || 0) + 1;
  }
  return counts;
}

function scorePlayerRound(cards) {
  const counts = countCards(cards);
  let score = 0;
  let pendingWasabi = 0;

  score += Math.floor((counts.tempura || 0) / 2) * 5;
  score += Math.floor((counts.sashimi || 0) / 3) * 10;
  score += GYOZA_SCORES[Math.min(counts.gyoza || 0, 5)];

  for (const cardId of cards) {
    const card = CARD_DEFS[cardId];
    if (!card) {
      continue;
    }

    if (card.kind === 'wasabi') {
      pendingWasabi += 1;
      continue;
    }

    if (card.kind !== 'nigiri') {
      continue;
    }

    if (pendingWasabi > 0) {
      score += card.nigiri * 3;
      pendingWasabi -= 1;
    } else {
      score += card.nigiri;
    }
  }

  return {
    score,
    maki: (counts.maki1 || 0) + (counts.maki2 || 0) * 2 + (counts.maki3 || 0) * 3,
    puddings: counts.pudding || 0
  };
}

function applyMakiBonuses(roundResults) {
  const sorted = [...roundResults].sort((a, b) => b.maki - a.maki);
  const topMaki = sorted[0]?.maki || 0;

  if (topMaki <= 0) {
    return;
  }

  const first = sorted.filter(result => result.maki === topMaki);
  const firstPoints = Math.floor(6 / first.length);
  first.forEach(result => {
    result.score += firstPoints;
  });

  if (first.length > 1) {
    return;
  }

  const secondMaki = sorted.find(result => result.maki < topMaki)?.maki || 0;
  if (secondMaki <= 0) {
    return;
  }

  const second = sorted.filter(result => result.maki === secondMaki);
  const secondPoints = Math.floor(3 / second.length);
  second.forEach(result => {
    result.score += secondPoints;
  });
}

function computeScores() {
  state.players.forEach(player => {
    player.roundScores = Array(TOTAL_ROUNDS).fill(0);
    player.puddings = 0;
    player.puddingScore = 0;
    player.subtotal = 0;
    player.total = 0;
  });

  for (let roundIndex = 0; roundIndex < TOTAL_ROUNDS; roundIndex += 1) {
    const results = state.players.map(player => {
      const round = scorePlayerRound(player.roundCards[roundIndex] || []);
      return {
        playerId: player.id,
        score: round.score,
        maki: round.maki,
        puddings: round.puddings
      };
    });

    applyMakiBonuses(results);

    results.forEach(result => {
      const player = state.players.find(item => item.id === result.playerId);
      player.roundScores[roundIndex] = result.score;
      player.puddings += result.puddings;
    });
  }

  applyPuddingBonuses();

  state.players.forEach(player => {
    player.subtotal = player.roundScores.reduce((sum, value) => sum + value, 0);
    player.total = player.subtotal + player.puddingScore;
  });

  const maxScore = Math.max(0, ...state.players.map(player => player.total));
  state.winnerIds = state.players.filter(player => player.total === maxScore).map(player => player.id);
}

function applyPuddingBonuses() {
  if (!state.players.length) {
    return;
  }

  const maxPuddings = Math.max(...state.players.map(player => player.puddings));
  const minPuddings = Math.min(...state.players.map(player => player.puddings));

  if (maxPuddings === minPuddings) {
    return;
  }

  const winners = state.players.filter(player => player.puddings === maxPuddings);
  const losers = state.players.filter(player => player.puddings === minPuddings);
  const winPoints = Math.floor(6 / winners.length);
  const losePoints = Math.floor(6 / losers.length);

  winners.forEach(player => {
    player.puddingScore += winPoints;
  });

  losers.forEach(player => {
    player.puddingScore -= losePoints;
  });
}

function getExpectedCardsPerPlayer() {
  return CARDS_PER_PLAYER[state.players.length || state.playerCount];
}

function getNextRound() {
  for (let roundIndex = 0; roundIndex < TOTAL_ROUNDS; roundIndex += 1) {
    const hasPendingPlayer = state.players.some(player => !player.roundCards[roundIndex]?.length);
    if (hasPendingPlayer) {
      return roundIndex + 1;
    }
  }
  return null;
}

function allRoundsComplete() {
  return getNextRound() === null;
}

function currentRoundLabel() {
  const round = getNextRound();
  return round ? `Ronda ${round}` : 'Partida terminada';
}

function cardsPerPlayerLabel() {
  return `${CARDS_PER_PLAYER[state.playerCount]} cartas por jugador`;
}

function updatePlayerCount(value) {
  state.playerCount = Number(value);
  state.screen = 'players';
  saveState();
  render();
}

function previewPlayerCount(value) {
  state.playerCount = Number(value);
  saveState();
  render();
}

function confirmPlayers(formData) {
  const names = [];
  for (let index = 0; index < state.playerCount; index += 1) {
    const value = String(formData.get(`player-${index}`) || '').trim();
    if (!value) {
      return `Falta completar el nombre del jugador ${index + 1}.`;
    }
    names.push(value.slice(0, 24));
  }

  state.players = buildPlayers(names);
  state.screen = 'board';
  state.scoringRound = 1;
  computeScores();
  saveState();
  render();
  return '';
}

function setScoringRound(round) {
  state.scoringRound = round;
  saveState();
  render();
}

function normalizeAlias(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseCardsInput(value) {
  const rawCards = value
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);

  const parsed = [];
  for (const rawCard of rawCards) {
    const normalized = normalizeAlias(rawCard);
    const cardId = Object.entries(CARD_DEFS).find(([, card]) => {
      return card.aliases.some(alias => normalizeAlias(alias) === normalized);
    })?.[0];

    if (!cardId) {
      return {
        error: `No reconozco la carta "${rawCard}".`
      };
    }

    parsed.push(cardId);
  }

  return { cards: parsed };
}

function formatCards(cards) {
  if (!cards.length) {
    return '—';
  }
  return cards.map(cardId => CARD_DEFS[cardId]?.label || cardId).join(', ');
}

function parseCardIdSequence(value) {
  const ids = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  for (const id of ids) {
    if (!CARD_DEFS[id]) {
      return { error: `No reconozco la carta "${id}".` };
    }
  }

  return { cards: ids };
}

function renderPuddingIcons(count) {
  if (!count) {
    return '';
  }

  return Array.from({ length: count }, () => '<span class="pudding-icon" aria-hidden="true">🧁</span>').join('');
}

function renderSequenceCards(cards) {
  if (!cards.length) {
    return '<p class="sequence-empty">Todavía no cargaste cartas.</p>';
  }

  return cards
    .map(
      (cardId, index) => `
        <button type="button" class="sequence-card" data-remove-index="${index}">
          <span class="sequence-card-index">${index + 1}</span>
          <img
            class="sequence-card-thumb"
            src="${CARD_DEFS[cardId]?.asset || ''}"
            alt="${escapeHtml(CARD_DEFS[cardId]?.label || cardId)}"
          />
          <span class="sequence-card-label">${escapeHtml(CARD_DEFS[cardId]?.label || cardId)}</span>
        </button>
      `
    )
    .join('');
}

function renderCardPalette() {
  return CARD_ORDER.map(
    cardId => `
      <button type="button" class="palette-card palette-${cardId}" data-add-card="${cardId}">
        <img
          class="palette-card-image"
          src="${CARD_DEFS[cardId].asset}"
          alt="${escapeHtml(CARD_DEFS[cardId].label)}"
        />
        <span class="palette-card-name">${escapeHtml(CARD_DEFS[cardId].label)}</span>
      </button>
    `
  ).join('');
}

async function detectCardsFromPhoto(file) {
  if (!window.SushiGoDetector) {
    return { error: 'El detector automatico no esta disponible.' };
  }

  try {
    const result = await window.SushiGoDetector.detect(file);
    if (!result.cards.length) {
      return {
        error: 'No pude detectar cartas en la foto. Probá con una imagen mas clara o cargá las cartas manualmente.'
      };
    }
    return result;
  } catch (error) {
    return {
      error: `Fallo el analisis de la imagen. ${error?.message ? `Detalle: ${error.message}. ` : ''}Probá de nuevo o completá las cartas manualmente.`
    };
  }
}

async function applyRoundEntries(formData) {
  const round = state.scoringRound;
  if (!round) {
    return 'No hay ronda activa para cargar.';
  }

  const expectedCards = getExpectedCardsPerPlayer();

  for (const player of state.players) {
    const image = formData.get(`photo-${player.id}`);
    const sequenceValue = String(formData.get(`sequence-${player.id}`) || '').trim();
    const hasPhoto = image instanceof File && image.size > 0;

    let cards = [];
    let source = '';

    if (sequenceValue) {
      const parsed = parseCardIdSequence(sequenceValue);
      if (parsed.error) {
        return `${player.name}: ${parsed.error}`;
      }
      cards = parsed.cards;
      source = 'manual';
    } else {
      if (!hasPhoto) {
        return `Falta subir la foto o cargar las cartas manualmente para ${player.name}.`;
      }
      const detected = await detectCardsFromPhoto(image);
      if (detected.error) {
        return `${player.name}: ${detected.error}`;
      }
      cards = detected.cards;
      source = 'auto';
    }

    if (cards.length !== expectedCards) {
      return `${player.name}: esperábamos ${expectedCards} cartas y ${
        source === 'auto' ? 'el detector obtuvo' : 'cargaste'
      } ${cards.length}.`;
    }

    player.roundCards[round - 1] = cards;
    player.roundNotes[round - 1] = formatCards(cards);
    player.roundSource[round - 1] = source;
    player.photos[round - 1] = hasPhoto
      ? {
          name: image.name,
          size: image.size,
          updatedAt: new Date().toISOString()
        }
      : null;
  }

  computeScores();
  state.scoringRound = getNextRound();
  saveState();
  render();
  return '';
}

function resetGame(keepPlayers) {
  if (!keepPlayers) {
    Object.assign(state, createInitialState());
    saveState();
    render();
    return;
  }

  const names = state.players.map(player => player.name);
  state.players = buildPlayers(names);
  state.screen = 'board';
  state.scoringRound = 1;
  computeScores();
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLanding() {
  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Sushi Go Scoreboard</span>
        <h1>Subí las jugadas, sumá las rondas y definí al ganador.</h1>
        <p>
          La app queda preparada para detectar cartas en una foto y calcular automáticamente el puntaje de cada ronda.
        </p>
        <form id="playerCountForm" class="hero-form card">
          <label for="playerCount">¿Cuántos jugadores van a jugar?</label>
          <p class="support-copy inline-copy">
            ${cardsPerPlayerLabel()}. En Sushi Go se juega de 2 a 5 jugadores.
          </p>
          <div class="hero-actions">
            <select id="playerCount" name="playerCount">
              ${PLAYER_OPTIONS.map(
                option =>
                  `<option value="${option}" ${option === state.playerCount ? 'selected' : ''}>${option} jugadores</option>`
              ).join('')}
            </select>
            <button type="submit">Jugar!</button>
          </div>
        </form>
      </div>
      <div class="hero-art card">
        <img class="cover-image" src="./assets/sushi-go-cover.jpg" alt="Portada de Sushi Go" />
        <p class="art-caption">
          Portada original del juego.
        </p>
      </div>
    </section>
  `;
}

function renderPlayersForm() {
  return `
    <section class="setup card">
      <div class="section-head">
        <div>
          <span class="eyebrow">Configuracion</span>
          <h2>Ingresá los nombres</h2>
        </div>
        <button type="button" class="ghost-btn" id="backToLanding">Volver</button>
      </div>
      <form id="playersForm" class="players-form">
        ${Array.from({ length: state.playerCount }, (_, index) => {
          return `
            <label>
              Jugador ${index + 1}
              <input
                type="text"
                name="player-${index}"
                maxlength="24"
                placeholder="Nombre"
                autocomplete="off"
              />
            </label>
          `;
        }).join('')}
        <button type="submit">Confirmar</button>
        <p id="playersError" class="error"></p>
      </form>
    </section>
  `;
}

function renderBoard() {
  const nextRound = getNextRound();
  const winners = state.players.filter(player => state.winnerIds.includes(player.id));
  const boardRows = [
    {
      label: 'Ronda 1',
      value: player => (player.roundCards[0].length ? player.roundScores[0] : '—'),
      puddings: player => countCards(player.roundCards[0]).pudding || 0
    },
    {
      label: 'Ronda 2',
      value: player => (player.roundCards[1].length ? player.roundScores[1] : '—'),
      puddings: player => countCards(player.roundCards[1]).pudding || 0
    },
    {
      label: 'Ronda 3',
      value: player => (player.roundCards[2].length ? player.roundScores[2] : '—'),
      puddings: player => countCards(player.roundCards[2]).pudding || 0
    },
    {
      label: 'Pudines',
      value: player => player.puddingScore || 0,
      puddings: player => player.puddings || 0
    },
    {
      label: 'Totales',
      value: player => player.total,
      puddings: () => 0,
      isTotal: true
    }
  ];

  return `
    <section class="board-shell">
      <div class="board-header">
        <div>
          <span class="eyebrow">Partida en curso</span>
          <h2>Tablero de puntuacion</h2>
        </div>
        <div class="header-actions">
          <button type="button" class="ghost-btn" id="samePlayers">Reiniciar con mismos jugadores</button>
          <button type="button" id="newMatch">Nueva partida</button>
        </div>
      </div>

      <section class="status-strip card">
        <div>
          <strong>Jugadores</strong>
          <span>${state.players.length}</span>
        </div>
        <div>
          <strong>Cartas por ronda</strong>
          <span>${getExpectedCardsPerPlayer()}</span>
        </div>
        <div>
          <strong>Estado</strong>
          <span>${currentRoundLabel()}</span>
        </div>
        <div>
          <strong>Ganador</strong>
          <span>${winners.length && allRoundsComplete() ? winners.map(player => escapeHtml(player.name)).join(', ') : 'A definir'}</span>
        </div>
      </section>

      <section class="scoreboard sketch-board card">
        <div class="sketch-grid" style="--player-count:${state.players.length}">
          <div class="corner-cell"></div>
          ${state.players
            .map(player => {
              const isWinner = state.winnerIds.includes(player.id) && allRoundsComplete();
              return `
                <div class="player-header ${isWinner ? 'winner-header' : ''}">
                  ${escapeHtml(player.name)}
                </div>
              `;
            })
            .join('')}

          ${boardRows
            .map(
              row => `
                <div class="row-label ${row.isTotal ? 'total-label' : ''}">${row.label}</div>
                ${state.players
                  .map(player => {
                    const value = row.value(player);
                    const puddingIcons = row.puddings(player);
                    return `
                      <div class="score-cell ${row.isTotal ? 'total-cell' : ''}">
                        <div class="score-value">${value}</div>
                        ${
                          puddingIcons
                            ? `<div class="cell-icons">${renderPuddingIcons(puddingIcons)}</div>`
                            : ''
                        }
                        ${
                          !row.isTotal && row.label !== 'Pudines'
                            ? `<div class="cell-meta">${
                                player.photos[Number(row.label.at(-1)) - 1]
                                  ? player.roundSource[Number(row.label.at(-1)) - 1] === 'auto'
                                    ? 'auto'
                                    : 'manual'
                                  : ''
                              }</div>`
                            : ''
                        }
                      </div>
                    `;
                  })
                  .join('')}
              `
            )
            .join('')}
        </div>
      </section>

      <section class="card summary-card">
        <div class="section-head compact">
          <div>
            <span class="eyebrow">Detalle</span>
            <h3>Cartas cargadas por ronda</h3>
          </div>
        </div>
        <div class="round-notes-grid">
          ${state.players
            .map(
              player => `
                <article class="round-notes-player">
                  <h4>${escapeHtml(player.name)}</h4>
                  ${player.roundCards
                    .map(
                      (cards, index) => `
                        <p><strong>Ronda ${index + 1}:</strong> ${escapeHtml(formatCards(cards))}</p>
                      `
                    )
                    .join('')}
                </article>
              `
            )
            .join('')}
        </div>
      </section>

      <section class="actions-grid">
        <section class="card scoring-card">
          <div class="section-head compact">
            <div>
              <span class="eyebrow">Carga de jugadas</span>
              <h3>Calcular puntos</h3>
            </div>
            ${
              nextRound
                ? `
                  <select id="roundSelector">
                    ${Array.from({ length: TOTAL_ROUNDS }, (_, index) => {
                      const roundNumber = index + 1;
                      return `<option value="${roundNumber}" ${
                        roundNumber === state.scoringRound ? 'selected' : ''
                      }>Ronda ${roundNumber}</option>`;
                    }).join('')}
                  </select>
                `
                : '<span class="chip done">Rondas completas</span>'
            }
          </div>
          <p class="support-copy">
            Podés subir una foto para detectar cartas o cargar toda la secuencia manualmente tocando la paleta.
          </p>
          <p class="support-copy">
            El orden importa: izquierda a derecha en fila, o por filas de arriba hacia abajo en matriz.
          </p>
          ${
            nextRound
              ? `
                <form id="scoringForm" class="scoring-form">
                  ${state.players
                    .map(
                      player => `
                        <article class="upload-card">
                          <h4>${escapeHtml(player.name)}</h4>
                          <label>
                            Foto de la jugada
                            <input
                              type="file"
                              name="photo-${player.id}"
                              accept="image/*"
                              capture="environment"
                              data-file-input="true"
                            />
                            <span class="file-hint">Sacá una foto o elegí una imagen desde el teléfono.</span>
                          </label>
                          <div class="sequence-tools">
                            <button type="button" class="ghost-btn detect-btn" data-detect-player="${player.id}">
                              Detectar desde foto
                            </button>
                            <button type="button" class="ghost-btn clear-btn" data-clear-player="${player.id}">
                              Limpiar
                            </button>
                          </div>
                          <div class="sequence-block">
                            <div class="sequence-head">
                              <strong>Cartas de la ronda (${getExpectedCardsPerPlayer()})</strong>
                              <span class="sequence-count" data-sequence-count="${player.id}">${
                                (player.roundCards[state.scoringRound - 1] || []).length
                              } / ${getExpectedCardsPerPlayer()}</span>
                            </div>
                            <input
                              type="hidden"
                              name="sequence-${player.id}"
                              value="${escapeHtml((player.roundCards[state.scoringRound - 1] || []).join(','))}"
                              data-sequence-input="${player.id}"
                            />
                            <div class="selected-sequence" data-sequence-list="${player.id}">
                              ${renderSequenceCards(player.roundCards[state.scoringRound - 1] || [])}
                            </div>
                            <div class="card-palette" data-card-palette="${player.id}">
                              ${renderCardPalette()}
                            </div>
                          </div>
                        </article>
                      `
                    )
                    .join('')}
                  <button type="submit">Guardar ronda y calcular</button>
                  <p id="scoringError" class="error"></p>
                </form>
              `
              : `
                <div class="finished-state">
                  <p>Las 3 rondas ya estan cargadas. El tablero ya muestra el total final incluyendo pudines.</p>
                </div>
              `
          }
        </section>

        <section class="card help-card">
          <div class="section-head compact">
            <div>
              <span class="eyebrow">Referencia</span>
              <h3>Reglas cargadas</h3>
            </div>
          </div>
          <ul class="help-list">
            <li>Tempura: cada pareja suma 5.</li>
            <li>Sashimi: cada trio suma 10.</li>
            <li>Gyoza: 1, 3, 6, 10, 15.</li>
            <li>Maki: 6 al primero, 3 al segundo, con division entera en empates.</li>
            <li>Nigiri + Wasabi: se resuelve segun el orden de izquierda a derecha.</li>
            <li>Pudin: cuenta al final; mas suma 6 y menos resta 6, con division entera en empates.</li>
            <li>Palillos: se reconocen pero no puntuan.</li>
          </ul>
        </section>
      </section>
    </section>
  `;
}

function render() {
  const app = document.querySelector('#app');

  app.innerHTML = `
    <div class="page-shell">
      ${state.screen === 'landing' ? renderLanding() : ''}
      ${state.screen === 'players' ? renderPlayersForm() : ''}
      ${state.screen === 'board' ? renderBoard() : ''}
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  const playerCountForm = document.querySelector('#playerCountForm');
  if (playerCountForm) {
    const playerCountSelect = playerCountForm.querySelector('#playerCount');
    if (playerCountSelect) {
      playerCountSelect.addEventListener('change', event => {
        previewPlayerCount(event.target.value);
      });
    }

    playerCountForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(playerCountForm);
      updatePlayerCount(formData.get('playerCount'));
    });
  }

  const backToLanding = document.querySelector('#backToLanding');
  if (backToLanding) {
    backToLanding.addEventListener('click', () => {
      state.screen = 'landing';
      saveState();
      render();
    });
  }

  const playersForm = document.querySelector('#playersForm');
  if (playersForm) {
    playersForm.addEventListener('submit', event => {
      event.preventDefault();
      const error = confirmPlayers(new FormData(playersForm));
      const errorNode = document.querySelector('#playersError');
      if (errorNode) {
        errorNode.textContent = error;
      }
    });
  }

  const roundSelector = document.querySelector('#roundSelector');
  if (roundSelector) {
    roundSelector.addEventListener('change', event => {
      setScoringRound(Number(event.target.value));
    });
  }

  const scoringForm = document.querySelector('#scoringForm');
  if (scoringForm) {
    const updateSequenceUI = playerId => {
      const input = scoringForm.querySelector(`[data-sequence-input="${playerId}"]`);
      const list = scoringForm.querySelector(`[data-sequence-list="${playerId}"]`);
      const count = scoringForm.querySelector(`[data-sequence-count="${playerId}"]`);
      const cards = String(input?.value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      if (list) {
        list.innerHTML = renderSequenceCards(cards);
      }
      if (count) {
        count.textContent = `${cards.length} / ${getExpectedCardsPerPlayer()}`;
      }
    };

    scoringForm.querySelectorAll('[data-add-card]').forEach(button => {
      button.addEventListener('click', () => {
        const playerId = button.closest('.upload-card').querySelector('[data-sequence-input]').dataset.sequenceInput;
        const input = scoringForm.querySelector(`[data-sequence-input="${playerId}"]`);
        const cards = String(input.value || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        cards.push(button.dataset.addCard);
        input.value = cards.join(',');
        updateSequenceUI(playerId);
      });
    });

    scoringForm.addEventListener('click', event => {
      const removeButton = event.target.closest('[data-remove-index]');
      if (removeButton) {
        const playerId = removeButton.closest('.upload-card').querySelector('[data-sequence-input]').dataset.sequenceInput;
        const input = scoringForm.querySelector(`[data-sequence-input="${playerId}"]`);
        const cards = String(input.value || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        cards.splice(Number(removeButton.dataset.removeIndex), 1);
        input.value = cards.join(',');
        updateSequenceUI(playerId);
      }
    });

    scoringForm.querySelectorAll('[data-clear-player]').forEach(button => {
      button.addEventListener('click', () => {
        const playerId = button.dataset.clearPlayer;
        const input = scoringForm.querySelector(`[data-sequence-input="${playerId}"]`);
        input.value = '';
        updateSequenceUI(playerId);
      });
    });

    scoringForm.querySelectorAll('[data-detect-player]').forEach(button => {
      button.addEventListener('click', async () => {
        const playerId = button.dataset.detectPlayer;
        const input = scoringForm.querySelector(`[data-sequence-input="${playerId}"]`);
        const fileInput = scoringForm.querySelector(`input[name="photo-${playerId}"]`);
        const errorNode = document.querySelector('#scoringError');
        const file = fileInput?.files?.[0];

        if (!file) {
          errorNode.textContent = 'Primero elegí una foto antes de detectar.';
          return;
        }

        button.disabled = true;
        button.textContent = 'Detectando...';
        const detected = await detectCardsFromPhoto(file);
        if (detected.error) {
          errorNode.textContent = detected.error;
        } else {
          input.value = detected.cards.join(',');
          updateSequenceUI(playerId);
          errorNode.textContent = '';
        }
        button.disabled = false;
        button.textContent = 'Detectar desde foto';
      });
    });

    scoringForm.querySelectorAll('[data-file-input="true"]').forEach(input => {
      input.addEventListener('change', () => {
        const hint = input.parentElement.querySelector('.file-hint');
        if (hint) {
          hint.textContent = input.files?.[0]?.name || 'Sacá una foto o elegí una imagen desde el teléfono.';
        }
      });
    });

    scoringForm.addEventListener('submit', async event => {
      event.preventDefault();
      const submitButton = scoringForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Analizando...';
      }
      const error = await applyRoundEntries(new FormData(scoringForm));
      const errorNode = document.querySelector('#scoringError');
      if (errorNode) {
        errorNode.textContent = error;
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar ronda y calcular';
      }
    });
  }

  const newMatch = document.querySelector('#newMatch');
  if (newMatch) {
    newMatch.addEventListener('click', () => resetGame(false));
  }

  const samePlayers = document.querySelector('#samePlayers');
  if (samePlayers) {
    samePlayers.addEventListener('click', () => resetGame(true));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  computeScores();
  if (state.screen === 'board' && !state.players.length) {
    Object.assign(state, createInitialState());
  }
  render();
});
