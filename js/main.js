/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
/** @type {number} */
let animationFrameId;
/** @type {number} */
let lastTimestamp = 0;
/** @type {Game} */
let game;
/** @type {boolean} */
let gamePaused = false;

/**
 * Initializes the game canvas and context
 * @throws {Error} If canvas or context cannot be initialized
 */
function initializeCanvas() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        throw new Error('Canvas element not found');
    }

    ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2D context');
    }

    // Set canvas size
    canvas.width = 800;
    canvas.height = 400;
}

/**
 * Handles keyboard down events
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyDown(event) {
    if (!game || !game.bird) return;
    
    switch(event.key) {
        case 'ArrowLeft':
            game.bird.startMovingLeft();
            event.preventDefault();
            break;
        case 'ArrowRight':
            game.bird.startMovingRight();
            event.preventDefault();
            break;
        case 'ArrowUp':
            game.bird.startMovingUp();
            event.preventDefault();
            break;
        case 'ArrowDown':
            game.bird.startMovingDown();
            event.preventDefault();
            break;
        case ' ':
            game.bird.drop();
            event.preventDefault();
            break;
        case 'p':
        case 'P':
            togglePause();
            event.preventDefault();
            break;
    }
}

/**
 * Toggles game pause state
 */
function togglePause() {
    gamePaused = !gamePaused;
    
    if (gamePaused) {
        // Draw pause message
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.font = '18px Arial';
        ctx.fillText('Press P to continue', canvas.width / 2, canvas.height / 2 + 40);
        ctx.restore();
    } else {
        // Resume game loop
        lastTimestamp = performance.now();
        gameLoop(lastTimestamp);
    }
}

/**
 * Handles keyboard up events
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyUp(event) {
    if (!game || !game.bird) return;
    
    switch(event.key) {
        case 'ArrowLeft':
            game.bird.stopMovingLeft();
            break;
        case 'ArrowRight':
            game.bird.stopMovingRight();
            break;
        case 'ArrowUp':
            game.bird.stopMovingUp();
            break;
        case 'ArrowDown':
            game.bird.stopMovingDown();
            break;
    }
}

/**
 * Main game loop
 * @param {number} timestamp - Current timestamp from requestAnimationFrame
 */
function gameLoop(timestamp) {
    // Calculate delta time in seconds
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // Cap at 0.1s to prevent large jumps
    lastTimestamp = timestamp;

    // Update and draw game state
    if (!gamePaused) {
        game.update(deltaTime);
        game.draw();
        
        // Request next frame
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

/**
 * Initializes game
 */
async function initGame() {
    try {
        initializeCanvas();
        await preloadAssets();
        
        // Create game instance
        game = new Game(canvas);
        
        // Add keyboard event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        // Draw initial instructions
        ctx.fillStyle = '#87CEEB'; // Sky blue background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HONK PATROL', canvas.width / 2, canvas.height / 2 - 60);
        
        ctx.font = '18px Arial';
        ctx.fillText('Use arrow keys to move the bird', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Press SPACE to drop on honking vehicles', canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText('Collect food to power up your droppings', canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText('Press P to pause the game', canvas.width / 2, canvas.height / 2 + 90);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Press any key to start', canvas.width / 2, canvas.height / 2 + 140);
        
        // Wait for any key press to start the game
        const startGame = (e) => {
            window.removeEventListener('keydown', startGame);
            
            // Start game loop
            lastTimestamp = performance.now();
            gameLoop(lastTimestamp);
            
            // Play start sound
            if (assets && assets.sounds && assets.sounds.ui && assets.sounds.ui.start) {
                assets.sounds.ui.start.currentTime = 0;
                assets.sounds.ui.start.play();
            }
        };
        
        window.addEventListener('keydown', startGame);
        
        console.log("Honk Patrol initialized successfully!");
        console.log("Use arrow keys to move the bird and spacebar to drop on honking vehicles!");
        console.log("Collect food items to power up your droppings!");
    } catch (error) {
        console.error('Game initialization failed:', error);
    }
}

// Start the game when the page loads
window.addEventListener('load', initGame); 