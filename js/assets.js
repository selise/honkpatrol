/** @type {Object.<string, any>} Global assets container */
const assets = {
    sounds: {
        effects: {},
        ui: {},
        vehicles: {}
    },
    visuals: {
        bird_flying: [],
        droppings: null, // Will be created programmatically
        food: {}, // Will store food item sprites
        vehicles: {
            car_sprites: { left: [], right: [] },
            bus_sprites: { left: [], right: [] },
            truck_sprites: { left: [], right: [] },
            emergency_sprites: { left: [], right: [] },
            fire_sprites: [] // Fire animation frames for vehicle crashes
        }
    }
};

/**
 * Creates a placeholder for failed image loads
 * @returns {HTMLCanvasElement} Canvas with transparent background (no red rectangle)
 */
function createPlaceholder() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 50;
    const ctx = canvas.getContext('2d');
    // Make the placeholder transparent instead of red
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 50, 50);
    return canvas;
}

/**
 * Creates a dropping sprite programmatically
 * @returns {HTMLCanvasElement} Canvas with dropping sprite
 */
function createDroppingSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 20;
    const ctx = canvas.getContext('2d');
    
    // Draw a brown circle
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(10, 10, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Add some detail
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.arc(8, 8, 3, 0, Math.PI * 2);
    ctx.fill();
    
    return canvas;
}

/**
 * Loads an image and returns a promise
 * @param {string} src - Image source path
 * @returns {Promise<HTMLImageElement>} Promise that resolves with the loaded image
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Failed to load image: ${src}`);
            resolve(createPlaceholder());
        };
        img.src = src;
    });
}

/**
 * Loads an audio file and returns a promise
 * @param {string} src - Audio source path
 * @returns {Promise<HTMLAudioElement>} Promise that resolves with the loaded audio
 */
function loadAudio(src) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => resolve(audio);
        audio.onerror = () => {
            console.warn(`Failed to load audio: ${src}`);
            reject(new Error(`Failed to load audio: ${src}`));
        };
        audio.src = src;
    });
}

/**
 * Preloads all game assets
 * @returns {Promise<void>} Promise that resolves when all assets are loaded
 */
async function preloadAssets() {
    const loadPromises = [];

    // Load sound effects
    const effects = ['poop', 'powerup', 'explosion', 'splat', 'crash', 'fire'];
    effects.forEach(effect => {
        const ext = effect === 'explosion' || effect === 'crash' || effect === 'fire' ? 'mp3' : 'wav';
        loadPromises.push(
            loadAudio(`assets/sounds/effects/${effect}.${ext}`)
                .then(audio => {
                    assets.sounds.effects[effect] = audio;
                    // Set volume for specific effects
                    if (effect === 'fire') {
                        audio.volume = 0.4; // Lower volume for ambient effect
                        audio.loop = true;
                    }
                })
                .catch(err => {
                    console.warn(`Failed to load audio: ${effect}`, err);
                    // Use explosion as fallback for crash and fire if they fail to load
                    if ((effect === 'crash' || effect === 'fire') && assets.sounds.effects.explosion) {
                        assets.sounds.effects[effect] = assets.sounds.effects.explosion;
                        console.log(`Using explosion sound as fallback for ${effect}`);
                    }
                })
        );
    });
    
    // Create dropping sprite programmatically since it doesn't exist
    assets.visuals.droppings = createDroppingSprite();
    
    // Load food sprites
    const foodItems = [
        'apple', 'burger', 'carrot', 'cherry', 'egg', 
        'fries', 'ham', 'pizza', 'strawberry', 'sushi', 'watermelon'
    ];
    foodItems.forEach(food => {
        loadPromises.push(
            loadImage(`assets/visuals/food/${food}.png`)
                .then(img => assets.visuals.food[food] = img)
                .catch(err => console.warn(`Failed to load food sprite: ${food}`, err))
        );
    });

    // Load UI sounds
    ['start', 'gameover', 'click'].forEach(sound => {
        loadPromises.push(
            loadAudio(`assets/sounds/ui/${sound}.wav`)
                .then(audio => assets.sounds.ui[sound] = audio)
                .catch(err => console.warn(`Failed to load UI sound: ${sound}`, err))
        );
    });

    // Load vehicle sounds
    ['old', 'sports', 'bus', 'truck', 'car'].forEach(vehicle => {
        loadPromises.push(
            loadAudio(`assets/sounds/vehicles/honk_${vehicle}.wav`)
                .then(audio => assets.sounds.vehicles[vehicle] = audio)
                .catch(err => console.warn(`Failed to load vehicle sound: ${vehicle}`, err))
        );
    });

    // Load bird animation frames
    for (let i = 0; i <= 16; i++) {
        loadPromises.push(
            loadImage(`assets/visuals/bird_flying/skeleton-01_fly_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.bird_flying[i] = img)
                .catch(err => console.warn(`Failed to load bird frame: ${i}`, err))
        );
    }

    // Car sprites - only load the ones that exist
    const carLeftFrames = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const carRightFrames = [1, 2, 3, 4, 5, 6, 7, 8];
    
    carLeftFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/car_sprites/car_left_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.car_sprites.left.push(img))
                .catch(err => console.warn(`Failed to load car sprite: left_${i}`, err))
        );
    });
    
    carRightFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/car_sprites/car_right_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.car_sprites.right.push(img))
                .catch(err => console.warn(`Failed to load car sprite: right_${i}`, err))
        );
    });
    
    // Bus sprites - only load the ones that exist
    const busLeftFrames = [1, 2];
    const busRightFrames = [1, 2, 3, 4];
    
    busLeftFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/bus_sprites/bus_left_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.bus_sprites.left.push(img))
                .catch(err => console.warn(`Failed to load bus sprite: left_${i}`, err))
        );
    });
    
    busRightFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/bus_sprites/bus_right_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.bus_sprites.right.push(img))
                .catch(err => console.warn(`Failed to load bus sprite: right_${i}`, err))
        );
    });
    
    // Truck sprites - only load the ones that exist
    const truckLeftFrames = [1, 2];
    const truckRightFrames = [1, 2, 3];
    
    truckLeftFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/truck_sprites/truck_left_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.truck_sprites.left.push(img))
                .catch(err => console.warn(`Failed to load truck sprite: left_${i}`, err))
        );
    });
    
    truckRightFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/truck_sprites/truck_right_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.truck_sprites.right.push(img))
                .catch(err => console.warn(`Failed to load truck sprite: right_${i}`, err))
        );
    });
    
    // Emergency sprites - only load the ones that exist
    const emergencyLeftFrames = [1, 2, 3];
    const emergencyRightFrames = [1, 2, 3, 4, 5];
    
    emergencyLeftFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/emergency_sprites/emergency_left_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.emergency_sprites.left.push(img))
                .catch(err => console.warn(`Failed to load emergency sprite: left_${i}`, err))
        );
    });
    
    emergencyRightFrames.forEach(i => {
        loadPromises.push(
            loadImage(`assets/visuals/vehicles/emergency_sprites/emergency_right_${i.toString().padStart(2, '0')}.png`)
                .then(img => assets.visuals.vehicles.emergency_sprites.right.push(img))
                .catch(err => console.warn(`Failed to load emergency sprite: right_${i}`, err))
        );
    });
    
    // Function to create a fallback fire sprite
    const createFireFallback = () => {
        console.warn('Creating fallback fire sprite');
        const placeholder = document.createElement('canvas');
        placeholder.width = placeholder.height = 80; // Larger size
        const ctx = placeholder.getContext('2d');
        
        // Create a more realistic flame shape
        // Use a flame-shaped path instead of a circle
        ctx.save();
        
        // Create base gradient (yellow to red)
        const gradient = ctx.createRadialGradient(40, 40, 5, 40, 40, 35);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.95)'); // Light yellow center
        gradient.addColorStop(0.4, 'rgba(255, 160, 0, 0.9)');  // Orange middle
        gradient.addColorStop(0.7, 'rgba(255, 50, 0, 0.8)');   // Red-orange edge
        gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');        // Fade out to transparent
        
        ctx.fillStyle = gradient;
        
        // Draw flame shape
        ctx.beginPath();
        
        // Start at bottom center
        ctx.moveTo(40, 65);
        
        // Left side of flame (create curves)
        ctx.bezierCurveTo(
            30, 55, // Control point 1
            20, 40, // Control point 2
            30, 20  // End point
        );
        
        // Flame tip (top)
        ctx.bezierCurveTo(
            35, 10, // Control point 1
            45, 10, // Control point 2
            50, 20  // End point
        );
        
        // Right side of flame
        ctx.bezierCurveTo(
            60, 40, // Control point 1
            50, 55, // Control point 2
            40, 65  // End point (back to start)
        );
        
        ctx.closePath();
        ctx.fill();
        
        // Add inner glow/highlight
        const innerGradient = ctx.createRadialGradient(40, 35, 2, 40, 35, 15);
        innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        innerGradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
        
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(40, 35, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        return placeholder;
    };
    
    // Simplified direct loading of fire sprites from the specific directory
    const loadFireSprites = async () => {
        console.log('Loading fire sprites from /assets/visuals/vehicles/fire_sprites');
        
        // Clear any existing fire sprites
        assets.visuals.vehicles.fire_sprites = [];
        
        // List of file names to try in the fire_sprites directory
        const fileNames = ['fire001.png', 'fire002.png', 'fire003.png', 'fire004.png'];
        let spritesLoaded = 0;
        
        // Load each file directly from the fire_sprites directory
        for (const fileName of fileNames) {
            try {
                const img = await loadImage(`assets/visuals/vehicles/fire_sprites/${fileName}`);
                assets.visuals.vehicles.fire_sprites.push(img);
                spritesLoaded++;
                console.log(`Successfully loaded fire sprite: ${fileName}`);
            } catch (err) {
                console.warn(`Failed to load fire sprite: ${fileName}`, err);
            }
        }
        
        // If no sprites were loaded, try directory listing or fall back to placeholders
        if (spritesLoaded === 0) {
            console.warn('No fire sprites loaded, checking directory contents...');
            
            try {
                // Try to load any PNG files from the directory
                const directoryFiles = [
                    'fire001.png', 'fire002.png', 'fire003.png', 'fire004.png',
                    'fire005.png', 'fire006.png', 'fire007.png', 'fire008.png'
                ];
                
                for (const file of directoryFiles) {
                    try {
                        const img = await loadImage(`assets/visuals/vehicles/fire_sprites/${file}`);
                        assets.visuals.vehicles.fire_sprites.push(img);
                        spritesLoaded++;
                        console.log(`Successfully loaded fire sprite: ${file}`);
                    } catch (err) {
                        // Silently fail for these attempts
                    }
                }
            } catch (err) {
                console.warn('Failed to check directory contents', err);
            }
        }
        
        // If still no sprites, create fallbacks
        if (spritesLoaded === 0) {
            console.warn('No fire sprites could be loaded, using fallbacks');
            for (let i = 0; i < 4; i++) {
                assets.visuals.vehicles.fire_sprites.push(createFireFallback());
            }
        }
        
        console.log(`Total fire sprites loaded: ${assets.visuals.vehicles.fire_sprites.length}`);
    };
    
    // Add the fire sprite loading promise
    loadPromises.push(loadFireSprites());
    
    try {
        await Promise.all(loadPromises);
        console.log('All available assets loaded successfully');
    } catch (error) {
        console.error('Error loading assets:', error);
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { assets, preloadAssets, loadImage, loadAudio, createPlaceholder };
} 