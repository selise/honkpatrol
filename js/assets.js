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
            emergency_sprites: { left: [], right: [] }
        }
    }
};

/**
 * Creates a placeholder for failed image loads
 * @returns {HTMLCanvasElement} Canvas with red rectangle
 */
function createPlaceholder() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
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
    const effects = ['poop', 'powerup', 'explosion', 'splat'];
    effects.forEach(effect => {
        const ext = effect === 'explosion' ? 'mp3' : 'wav';
        loadPromises.push(
            loadAudio(`assets/sounds/effects/${effect}.${ext}`)
                .then(audio => assets.sounds.effects[effect] = audio)
                .catch(err => console.warn(`Failed to load audio: ${effect}`, err))
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