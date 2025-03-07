/**
 * Manages the game state and core gameplay
 * @class
 */
class Game {
    /**
     * Creates a new Game instance
     * @param {HTMLCanvasElement} canvas - The game canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bird = new Bird(canvas.width / 2, canvas.height / 2, canvas.width, canvas.height);
        this.vehicles = [];
        this.foods = [];
        this.droppings = [];
        
        // Scoring and progression
        this.score = 0;
        this.wave = 1;
        this.vehiclesPerWave = 5;
        this.vehiclesSpawned = 0;
        this.waveTimer = 0;
        this.waveDuration = 30; // 30 seconds per wave
        
        // Vehicle spawning
        this.vehicleSpawnTimer = 0;
        this.baseSpawnInterval = 2; // Initial seconds between vehicle spawns
        this.maxVehicles = 10; // Maximum number of vehicles allowed
        
        // Food spawning
        this.foodSpawnTimer = 0;
        this.foodSpawnInterval = 10; // Seconds between food spawns
        this.maxFoods = 3; // Maximum number of food items allowed
        
        // Visual effects
        this.effects = []; // Array to store temporary visual effects
    }

    /**
     * Calculates the current vehicle spawn interval based on wave
     * @returns {number} Spawn interval in seconds
     */
    getVehicleSpawnInterval() {
        // Reduce spawn interval by 0.2 seconds per wave, with a minimum of 1 second
        return Math.max(1, this.baseSpawnInterval - (this.wave - 1) * 0.2);
    }

    /**
     * Updates game state
     * @param {number} deltaTime - Time elapsed since last update in seconds
     */
    update(deltaTime) {
        // Update wave timer and progression
        this.waveTimer += deltaTime;
        if (this.waveTimer >= this.waveDuration) {
            this.startNewWave();
        }
        
        // Update bird
        this.bird.update(deltaTime);
        
        // Get and track active dropping from bird
        const birdDropping = this.bird.getActiveDropping();
        if (birdDropping && !this.droppings.includes(birdDropping)) {
            this.droppings.push(birdDropping);
            this.bird.removeDropping();
        }

        // Spawn vehicles
        this.vehicleSpawnTimer += deltaTime;
        const currentSpawnInterval = this.getVehicleSpawnInterval();
        
        if (this.vehicleSpawnTimer >= currentSpawnInterval && 
            this.vehicles.length < this.maxVehicles && 
            this.vehiclesSpawned < this.vehiclesPerWave) {
            this.spawnVehicle();
            this.vehicleSpawnTimer = 0;
            this.vehiclesSpawned++;
        }
        
        // Spawn food
        this.foodSpawnTimer += deltaTime;
        if (this.foodSpawnTimer >= this.foodSpawnInterval && this.foods.length < this.maxFoods) {
            this.spawnFood();
            this.foodSpawnTimer = 0;
        }

        // Update vehicles
        this.vehicles = this.vehicles.filter(vehicle => {
            return vehicle.update(deltaTime);
        });
        
        // Update food items
        this.foods = this.foods.filter(food => {
            return food.update(deltaTime);
        });
        
        // Check for bird collision with food
        this.foods = this.foods.filter(food => {
            if (food.checkCollision(this.bird)) {
                // Bird ate the food
                this.bird.eatFood(food);
                return false; // Remove the food
            }
            return true; // Keep the food
        });

        // Update droppings and check collisions
        this.droppings = this.droppings.filter(dropping => {
            // Update dropping position
            dropping.y += dropping.speed * deltaTime;
            
            // Check for collision with any vehicle
            let hasCollided = false;
            let hitVehicles = [];
            
            // First pass: identify all vehicles within splash radius
            for (const vehicle of this.vehicles) {
                if (vehicle.checkCollision(dropping)) {
                    // Direct hit
                    hitVehicles.push(vehicle);
                    hasCollided = true;
                } else if (dropping.splashRadius > 0) {
                    // Check for splash damage
                    const dx = vehicle.x - dropping.x;
                    const dy = vehicle.y - dropping.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= dropping.splashRadius) {
                        hitVehicles.push(vehicle);
                        hasCollided = true;
                    }
                }
            }
            
            // Second pass: handle all hit vehicles
            for (const vehicle of hitVehicles) {
                const wasHonking = vehicle.isHonking;
                const points = vehicle.handleHit();
                
                // Add score based on honking state
                this.score = Math.max(0, this.score + points); // Ensure score doesn't go below 0
                
                // Play appropriate sound effect
                if (wasHonking) {
                    // Play hit sound
                    if (assets && assets.sounds && assets.sounds.effects && assets.sounds.effects.explosion) {
                        assets.sounds.effects.explosion.currentTime = 0;
                        assets.sounds.effects.explosion.play();
                    }
                } else {
                    // Play miss sound
                    if (assets && assets.sounds && assets.sounds.effects && assets.sounds.effects.splat) {
                        assets.sounds.effects.splat.currentTime = 0;
                        assets.sounds.effects.splat.play();
                    }
                }
                
                // Create visual effect at the hit location
                this.createHitEffect(dropping.x, dropping.y, wasHonking);
            }
            
            // Keep the dropping if it's still on screen and hasn't collided
            return !hasCollided && dropping.y < this.canvas.height;
        });
        
        // Update visual effects
        this.effects = this.effects.filter(effect => {
            effect.lifetime -= deltaTime;
            return effect.lifetime > 0;
        });
        
        // Start a new wave if all vehicles have been spawned and none remain
        if (this.vehiclesSpawned >= this.vehiclesPerWave && this.vehicles.length === 0) {
            this.startNewWave();
        }
    }

    /**
     * Creates a visual hit effect
     * @param {number} x - X position of the effect
     * @param {number} y - Y position of the effect
     * @param {boolean} wasHonking - Whether the vehicle was honking
     */
    createHitEffect(x, y, wasHonking) {
        this.effects.push({
            x: x,
            y: y,
            radius: wasHonking ? 30 : 20,
            color: wasHonking ? '#FFD700' : '#8B4513', // Gold for honking, brown for not
            lifetime: 0.5 // seconds
        });
    }

    /**
     * Starts a new wave
     */
    startNewWave() {
        this.wave++;
        this.vehiclesPerWave += 2; // Increase vehicles per wave
        this.vehiclesSpawned = 0;
        this.waveTimer = 0;
        
        // Play wave start sound
        if (assets && assets.sounds && assets.sounds.ui && assets.sounds.ui.start) {
            assets.sounds.ui.start.currentTime = 0;
            assets.sounds.ui.start.play();
        }
    }

    /**
     * Draws the game state
     */
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB'; // Sky blue
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw food items
        this.foods.forEach(food => food.draw(this.ctx));

        // Draw vehicles
        this.vehicles.forEach(vehicle => vehicle.draw(this.ctx));
        
        // Draw droppings
        this.droppings.forEach(dropping => {
            this.ctx.fillStyle = '#8B4513'; // Brown color
            this.ctx.beginPath();
            this.ctx.arc(dropping.x, dropping.y, dropping.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw splash radius if applicable
            if (dropping.splashRadius > 0) {
                this.ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)'; // Transparent brown
                this.ctx.beginPath();
                this.ctx.arc(dropping.x, dropping.y, dropping.splashRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        });
        
        // Draw visual effects
        this.effects.forEach(effect => {
            const alpha = effect.lifetime / 0.5; // Fade out over lifetime
            this.ctx.fillStyle = effect.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw bird
        this.bird.draw(this.ctx);

        // Draw HUD (score, wave info)
        this.drawHUD();
    }
    
    /**
     * Draws the heads-up display (HUD)
     */
    drawHUD() {
        this.ctx.save();
        
        // Draw score
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        
        // Draw power level
        const powerState = this.bird.getPowerUpState();
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Power Level: ${powerState.powerUpLevel}`, this.canvas.width - 10, 30);
        
        // Draw wave information
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Wave: ${this.wave}`, this.canvas.width / 2, 30);
        
        // Draw wave progress
        const waveProgressWidth = 200;
        const waveProgressHeight = 10;
        const waveProgressX = (this.canvas.width - waveProgressWidth) / 2;
        const waveProgressY = 40;
        
        // Draw background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(waveProgressX, waveProgressY, waveProgressWidth, waveProgressHeight);
        
        // Draw progress
        const progress = Math.min(1, this.waveTimer / this.waveDuration);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(waveProgressX, waveProgressY, waveProgressWidth * progress, waveProgressHeight);
        
        // Draw vehicles remaining
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#000';
        this.ctx.font = '18px Arial';
        this.ctx.fillText(`Vehicles: ${this.vehiclesSpawned}/${this.vehiclesPerWave}`, 10, 70);
        
        this.ctx.restore();
    }

    /**
     * Spawns a new vehicle
     */
    spawnVehicle() {
        // Create a new vehicle and add it to the array
        const vehicle = new Vehicle(this.canvas.width, this.canvas.height);
        this.vehicles.push(vehicle);
        
        // If the vehicle is honking, make it honk immediately
        if (vehicle.isHonking) {
            vehicle.playHonkSound();
            vehicle.lastHonkTime = Date.now();
        }
        
        return vehicle;
    }
    
    /**
     * Spawns a new food item
     */
    spawnFood() {
        // Create a new food item and add it to the array
        const food = new Food(this.canvas.width, this.canvas.height);
        this.foods.push(food);
        return food;
    }

    /**
     * Handles spacebar press to trigger bird dropping
     */
    handleSpacebar() {
        this.bird.drop();
    }

    /**
     * Gets the current game state
     * @returns {Object} Current game state
     */
    getState() {
        return {
            score: this.score,
            wave: this.wave,
            vehiclesPerWave: this.vehiclesPerWave,
            vehiclesSpawned: this.vehiclesSpawned,
            vehicleCount: this.vehicles.length,
            foodCount: this.foods.length,
            droppingCount: this.droppings.length,
            birdPosition: this.bird.getPosition(),
            powerUpLevel: this.bird.getPowerUpState().powerUpLevel
        };
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game };
} 