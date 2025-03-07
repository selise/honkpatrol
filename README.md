# Honk Patrol

A game where a bird poops on honking vehicles to clear traffic. Run with a local server (e.g., Live Server). Assets in /assets.

## Project Structure

```
honk-patrol/
├── assets/           # Game assets (sounds and visuals)
├── css/
│   └── style.css    # Game styles
├── js/
│   ├── assets.js    # Asset loading and management
│   ├── bird.js      # Bird player class
│   ├── vehicle.js   # Vehicle class
│   ├── game.js      # Core game logic
│   ├── powerups.js  # Powerup system
│   ├── main.js      # Game initialization
│   └── tests/       # Test files
└── index.html       # Main game page
```

## Setup

1. Clone the repository
2. Start a local server (e.g., using VS Code's Live Server extension)
3. Open `index.html` through the local server

## Development

- All game assets are preloaded before the game starts
- The game uses HTML5 Canvas for rendering
- Modular JavaScript code with ES6+ features
- JSDoc documentation for all major functions

## Testing

Test files will be located in the `js/tests/` directory (to be implemented). 