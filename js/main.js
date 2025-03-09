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
            // Use the game's handleSpacebar method to handle both dropping and restarting
            game.handleSpacebar();
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
 * @returns {Promise<void>}
 */
async function initGame() {
    try {
        // Initialize canvas
        initializeCanvas();
        
        // Apply pixel scaling for retro look
        ctx.imageSmoothingEnabled = false;
        
        // Load assets first
        await preloadAssets();
        
        // Debug fire sprites
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        console.log(`Game initialized with ${fireSprites ? fireSprites.length : 0} fire sprites loaded`);
        if (fireSprites && fireSprites.length > 0) {
            console.log('Fire sprites loaded from /assets/visuals/vehicles/fire_sprites:', fireSprites);
        } else {
            console.warn('No fire sprites were loaded from /assets/visuals/vehicles/fire_sprites');
        }
        
        // Create splash screen
        ctx.fillStyle = '#87CEEB'; // Sky blue
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw title
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const title = 'HONK PATROL';
        ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 50);
        ctx.strokeText(title, canvas.width / 2, canvas.height / 2 - 50);
        
        // Create game instance
        game = new Game(canvas);
        
        // Add keyboard event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        // Draw initial instructions
        ctx.fillStyle = '#000';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Use arrow keys to move the bird', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Press SPACE to drop on honking vehicles', canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText('Collect food to power up your droppings', canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText('Press P to pause the game', canvas.width / 2, canvas.height / 2 + 90);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillText('Press any key to start', canvas.width / 2, canvas.height / 2 + 140);
        
        // Wait for any key press to start the game
        const startGame = (e) => {
            window.removeEventListener('keydown', startGame);
            
            // Test fire sprites loading and crash animation
            setTimeout(() => {
                // Only run the test in development environments
                if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                    console.log('Testing fire animation with sprites from /assets/visuals/vehicles/fire_sprites');
                    
                    // Create a test fire at center screen
                    const testFire = new Fire(
                        canvas.width / 2, 
                        canvas.height / 2, 
                        100, 
                        120, 
                        5
                    );
                    
                    // Add the fire to the game effects for rendering
                    if (game.effects) {
                        game.effects.push({
                            update: (deltaTime) => testFire.update(deltaTime),
                            draw: (ctx) => testFire.draw(ctx)
                        });
                    } else {
                        // If no effects array, just run a standalone test
                        let elapsed = 0;
                        const testInterval = setInterval(() => {
                            elapsed += 0.016; // ~60fps
                            if (elapsed < 5 && testFire.update(0.016)) {
                                // Keep updating
                            } else {
                                clearInterval(testInterval);
                            }
                        }, 16);
                    }
                }
            }, 2000); // Wait 2 seconds after game start
            
            // Start the game loop
            lastTimestamp = 0;
            gamePaused = false;
            requestAnimationFrame(gameLoop);
            
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

/**
 * Tests the Fire class with sprites from /assets/visuals/vehicles/fire_sprites
 */
function testFireEffect() {
    // Create a test fire at the center of the screen
    const testFire = new Fire(
        canvas.width / 2,   // x
        canvas.height / 2,  // y
        100,                // width
        120,                // height
        5                   // duration
    );
    
    console.log('Test fire created to verify /assets/visuals/vehicles/fire_sprites usage');
    
    // Draw the fire for 5 seconds
    let startTime = Date.now();
    
    function drawTestFire() {
        // Clear a portion of the canvas
        ctx.clearRect(
            canvas.width / 2 - 100, 
            canvas.height / 2 - 100, 
            200, 
            200
        );
        
        // Update and draw the fire
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed < 5 && testFire.update(0.016)) { // 60fps = ~16ms
            testFire.draw(ctx);
            requestAnimationFrame(drawTestFire);
        } else {
            console.log('Fire test complete');
        }
    }
    
    // Start the animation
    drawTestFire();
}

// Start the game when the page loads
window.addEventListener('load', initGame); 