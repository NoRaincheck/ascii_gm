import { generateCard } from '../lib/card.ts';
import { setOracles } from '../lib/oracle_data.ts';
import { parseSpritesheet, renderCardToCanvas } from '../lib/spritesheet.ts';

const cardContainer = document.getElementById('card-container');
const generateBtn = document.getElementById('generate-btn');
const themeSelect = document.getElementById('theme-select');
const layoutSelect = document.getElementById('layout-select');
const modeToggle = document.getElementById('mode-toggle');
const modeLabel = document.getElementById('mode-label');

let currentCard = '';
let imageMode = true;
let spritesheetLoaded = false;
let cards = []; // array of { cardText, theme, layout }

async function init() {
  await loadOraclesJSON();
  await loadSpritesheet();
  newCard();
  generateBtn.addEventListener('click', newCard);
  themeSelect.addEventListener('change', renderAllCards);
  layoutSelect.addEventListener('change', renderAllCards);
  modeToggle.addEventListener('click', toggleMode);
  document.addEventListener('keydown', handleKeyDown);
}

async function loadOraclesJSON() {
  const resp = await fetch('ironsworn_oracles.json');
  const data = await resp.json();
  setOracles(data);
}

async function loadSpritesheet() {
  const img = new Image();
  img.src = 'spritesheet.png';
  await img.decode();

  const offscreen = document.createElement('canvas');
  offscreen.width = img.width;
  offscreen.height = img.height;
  const octx = offscreen.getContext('2d');
  octx.drawImage(img, 0, 0);
  parseSpritesheet(img, octx);
  spritesheetLoaded = true;
}

function newCard() {
  currentCard = generateCard(layoutSelect.value);
  cards.push({ cardText: currentCard, theme: themeSelect.value, layout: layoutSelect.value });
  renderAllCards();
}

function renderAllCards() {
  // Clear existing card elements
  cardContainer.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  cardContainer.appendChild(grid);

  for (const cardData of cards) {
    const canvas = document.createElement('canvas');
    canvas.className = 'card-canvas';
    const ctx = canvas.getContext('2d');
    renderCardToCanvas(ctx, cardData.cardText, cardData.theme, imageMode, cardData.layout);
    grid.appendChild(canvas);
  }
}

function toggleMode() {
  imageMode = !imageMode;
  modeLabel.textContent = imageMode ? 'Image Mode' : 'Canvas Mode';
  modeToggle.textContent = imageMode ? 'Switch to Canvas Mode' : 'Switch to Image Mode';
  renderAllCards();
}

function handleKeyDown(e) {
  // Don't capture keys when user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  switch (e.key) {
    case 'Enter':
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      newCard();
      break;
    case 'ArrowUp':
      e.preventDefault();
      cycleTheme();
      break;
    case 'ArrowDown':
      e.preventDefault();
      cycleTheme();
      break;
  }
}

function cycleTheme() {
  const themes = ['macchiato', 'latte'];
  const currentIdx = themes.indexOf(themeSelect.value);
  const nextIdx = themeSelect.value === 'macchiato' ? 1 : 0;
  themeSelect.value = themes[nextIdx];
  renderAllCards();
}

init();
