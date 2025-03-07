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
        this.effects = []; // For visual effects like fires
        this.scoreAnimations = []; // Array to track floating score animations
        
        // Test the fire sprites at game start
        this.testFireEffect();
        
        // Scoring and progression
        this.score = 0;
        this.wave = 1;
        this.vehiclesPerWave = 5; // Starting with a smaller, more manageable number
        this.vehiclesSpawned = 0;
        this.waveTimer = 0;
        this.waveDuration = 30; // 30 seconds per wave
        
        // Vehicle spawning
        this.vehicleSpawnTimer = 0;
        this.baseSpawnInterval = 2; // Initial seconds between vehicle spawns
        this.maxVehicles = 15; // Maximum number of vehicles on screen at once
        
        // Food spawning
        this.foodSpawnTimer = 0;
        this.foodSpawnInterval = 10; // Seconds between food spawns
        this.maxFoods = 3; // Maximum number of food items allowed
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
            return vehicle.update(deltaTime, this.vehicles);
        });
        
        // Update food items
        this.foods = this.foods.filter(food => {
            return food.update(deltaTime);
        });
        
        // Update effects (like fire animations)
        this.effects = this.effects.filter(effect => {
            return effect.update(deltaTime);
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
            // Handle different dropping types
            if (dropping.type === 'single') {
                // Update position for single dropping
                dropping.y += dropping.speed * deltaTime;
                
                // Single poop collision handling
                return this.handleDroppingCollisions(dropping, dropping);
            } else if (dropping.type === 'multi' || dropping.type === 'laser') {
                // For multi and laser types, they have their own update function
                const stillActive = dropping.update(deltaTime);
                
                // For laser and multi types, handle collisions without removing individual poops
                const poops = dropping.getPoops();
                let anyCollision = false;
                
                for (const poop of poops) {
                    // Check for collisions but don't remove individual poops
                    // This allows both laser and multi types to hit multiple vehicles
                    if (this.checkPoopCollisionWithVehicles(poop, dropping)) {
                        anyCollision = true;
                    }
                }
                
                // Both laser and multi types remain until either:
                // - Their lifetime expires (laser)
                // - They go off screen (multi)
                // This allows them to hit multiple vehicles
                return stillActive;
            } else {
                // Fallback for old dropping format (for backward compatibility)
                dropping.y += dropping.speed * deltaTime;
                return dropping.y < this.canvas.height;
            }
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

        // Update score animations
        this.scoreAnimations = this.scoreAnimations.filter(animation => {
            return animation.update(deltaTime);
        });
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
            lifetime: 0.5, // seconds
            timer: 0,
            update: function(deltaTime) {
                this.timer += deltaTime;
                return this.timer < this.lifetime;
            },
            draw: function(ctx) {
                // Calculate opacity based on remaining lifetime
                const opacity = Math.max(0, 1 - (this.timer / this.lifetime));
                
                // Draw expanding circle
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * (1 + this.timer / this.lifetime), 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    /**
     * Starts a new wave
     */
    startNewWave() {
        this.wave++;
        // More balanced progression: add 5 vehicles per wave up to wave 5, then add 10 per wave
        if (this.wave <= 5) {
            this.vehiclesPerWave += 5; // +5 vehicles per wave (5, 10, 15, 20, 25)
        } else {
            this.vehiclesPerWave += 10; // +10 for later waves (35, 45, 55, etc.)
        }
        
        // Cap the maximum vehicles per wave at 100 to prevent it from becoming unplayable
        this.vehiclesPerWave = Math.min(this.vehiclesPerWave, 100);
        
        this.vehiclesSpawned = 0;
        this.waveTimer = 0;
        
        // Play wave start sound
        if (assets && assets.sounds && assets.sounds.ui && assets.sounds.ui.start) {
            assets.sounds.ui.start.currentTime = 0;
            assets.sounds.ui.start.play();
        }
    }

    /**
     * Draws the game state to the canvas
     */
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw sky (increased height for more sky space)
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height - 250); // Leave more space for sky
        
        // Draw road and scenery
        if (this.vehicles.length > 0) {
            const vehicle = this.vehicles[0]; // Use first vehicle to get lane info
            const totalLanes = vehicle.totalLanes;
            const laneHeight = vehicle.laneHeight;
            const laneStartY = vehicle.laneStartY;
            
            // Draw trees on the left side
            this.drawTrees(50, laneStartY, laneHeight * totalLanes, 'left');
            
            // Draw trees on the right side
            this.drawTrees(this.canvas.width - 50, laneStartY, laneHeight * totalLanes, 'right');
            
            // Draw road with gradient for depth effect
            const roadGradient = this.ctx.createLinearGradient(0, laneStartY, 0, laneStartY + laneHeight * totalLanes);
            roadGradient.addColorStop(0, '#4a4a4a'); // Darker at top
            roadGradient.addColorStop(1, '#666666'); // Lighter at bottom
            
            this.ctx.fillStyle = roadGradient;
            this.ctx.fillRect(0, laneStartY, this.canvas.width, laneHeight * totalLanes);
            
            // Draw road texture (subtle noise pattern)
            this.drawRoadTexture(laneStartY, laneHeight * totalLanes);
            
            // Draw road edges
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, laneStartY);
            this.ctx.lineTo(this.canvas.width, laneStartY);
            this.ctx.moveTo(0, laneStartY + laneHeight * totalLanes);
            this.ctx.lineTo(this.canvas.width, laneStartY + laneHeight * totalLanes);
            this.ctx.stroke();
        }
        
        // Draw ground with grass texture
        this.drawGround();
        
        // Draw food items
        for (const food of this.foods) {
            food.draw(this.ctx);
        }
        
        // Draw vehicles
        for (const vehicle of this.vehicles) {
            vehicle.draw(this.ctx);
        }
        
        // Draw droppings
        for (const dropping of this.droppings) {
            dropping.draw(this.ctx);
        }
        
        // Draw effects (like fire animations)
        for (const effect of this.effects) {
            effect.draw(this.ctx);
        }
        
        // Draw score animations on top of everything
        for (const animation of this.scoreAnimations) {
            animation.draw(this.ctx);
        }
        
        // Draw bird on top
        this.bird.draw(this.ctx);
        
        // Draw HUD
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

    /**
     * Tests the fire animation by creating a crash
     * This is for development purposes to verify fire sprites are loading correctly
     */
    testFireAnimation() {
        console.log('Testing fire animation with sprites from /assets/visuals/vehicles/fire_sprites');
        
        // Create two vehicles in the same lane moving toward each other
        const vehicle1 = this.spawnVehicle();
        vehicle1.x = this.canvas.width / 3;
        vehicle1.direction = 'right';
        vehicle1.lane = 2;
        vehicle1.y = vehicle1.laneStartY + (vehicle1.lane * vehicle1.laneHeight) + (vehicle1.laneHeight / 2);
        
        const vehicle2 = this.spawnVehicle();
        vehicle2.x = this.canvas.width * 2 / 3;
        vehicle2.direction = 'left';
        vehicle2.lane = 2;
        vehicle2.y = vehicle2.laneStartY + (vehicle2.lane * vehicle2.laneHeight) + (vehicle2.laneHeight / 2);
        
        // Force a crash
        vehicle1.crash();
        vehicle2.crash();
        
        console.log('Created test crash with fire animation');
    }

    /**
     * Creates a test fire effect to verify fire sprites are loading correctly
     */
    testFireEffect() {
        console.log('Testing fire effect with sprites from /assets/visuals/vehicles/fire_sprites');
        
        // Log fire sprites info
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        console.log(`Game initialized with ${fireSprites ? fireSprites.length : 0} fire sprites`);
        
        // Create a test fire that will display for a few seconds
        const testFire = new Fire(
            this.canvas.width / 2, 
            this.canvas.height / 2, 
            100,  // width 
            120,  // height
            3     // duration (seconds)
        );
        
        // Add to effects array with both update and draw methods
        this.effects.push({
            fire: testFire,
            update: function(deltaTime) {
                return this.fire.update(deltaTime);
            },
            draw: function(ctx) {
                this.fire.draw(ctx);
            }
        });
    }

    /**
     * Draws trees along the side of the road
     * @param {number} x - X position to start drawing trees
     * @param {number} y - Y position to start drawing trees
     * @param {number} height - Height of the tree area
     * @param {string} side - Which side of the road ('left' or 'right')
     */
    drawTrees(x, y, height, side) {
        const treeSpacing = 100; // Space between trees
        const numTrees = Math.floor(height / treeSpacing);
        
        for (let i = 0; i < numTrees; i++) {
            const treeY = y + (i * treeSpacing);
            
            // Draw tree trunk
            this.ctx.fillStyle = '#4a2f1c';
            this.ctx.fillRect(x - 5, treeY, 10, 40);
            
            // Draw tree top (triangle)
            this.ctx.fillStyle = '#2d5a27';
            this.ctx.beginPath();
            this.ctx.moveTo(x - 20, treeY);
            this.ctx.lineTo(x + 20, treeY);
            this.ctx.lineTo(x, treeY - 40);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Add some random variation to tree positions
            x += (Math.random() - 0.5) * 20;
        }
    }

    /**
     * Draws a subtle texture on the road
     * @param {number} y - Y position to start drawing texture
     * @param {number} height - Height of the road
     */
    drawRoadTexture(y, height) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.1;
        
        for (let i = 0; i < height; i += 2) {
            for (let j = 0; j < this.canvas.width; j += 2) {
                if (Math.random() < 0.1) {
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.fillRect(j, y + i, 2, 2);
                }
            }
        }
        
        this.ctx.restore();
    }

    /**
     * Draws the ground with grass texture
     */
    drawGround() {
        const groundY = this.canvas.height - 50;
        
        // Draw base ground color
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, groundY, this.canvas.width, 50);
        
        // Draw grass texture
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < 50; i += 2) {
            for (let j = 0; j < this.canvas.width; j += 2) {
                if (Math.random() < 0.2) {
                    this.ctx.fillStyle = '#228B22'; // Forest green
                    this.ctx.fillRect(j, groundY + i, 2, 2);
                }
            }
        }
        
        this.ctx.restore();
    }

    /**
     * Creates a floating score animation
     * @param {number} x - X position where the score should appear
     * @param {number} y - Y position where the score should appear
     * @param {number} points - The number of points (positive or negative)
     */
    createScoreAnimation(x, y, points) {
        this.scoreAnimations.push({
            x: x,
            y: y,
            points: points,
            lifetime: 1.0, // seconds
            timer: 0,
            update: function(deltaTime) {
                this.timer += deltaTime;
                // Move upward and fade out
                this.y -= 30 * deltaTime; // Move up at 30 pixels per second
                return this.timer < this.lifetime;
            },
            draw: function(ctx) {
                // Calculate opacity based on remaining lifetime
                const opacity = Math.max(0, 1 - (this.timer / this.lifetime));
                
                ctx.save();
                ctx.globalAlpha = opacity;
                
                // Set color based on positive/negative points
                ctx.fillStyle = this.points > 0 ? '#00FF00' : '#FF0000';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                
                // Add + or - symbol
                const text = (this.points > 0 ? '+' : '') + this.points;
                ctx.fillText(text, this.x, this.y);
                
                ctx.restore();
            }
        });
    }

    /**
     * Handle collision checks for a dropping or sub-dropping
     * @param {Object} poop - The individual poop to check for collisions
     * @param {Object} parentDropping - The parent dropping object (for multi/laser types)
     * @returns {boolean} true if the dropping should be kept, false if it collided
     * @private
     */
    handleDroppingCollisions(poop, parentDropping) {
        // Check for collision with any vehicle
        let hasCollided = false;
        let hitVehicles = [];
        
        // First pass: identify all vehicles within splash radius
        for (const vehicle of this.vehicles) {
            if (vehicle.checkCollision(poop)) {
                // Direct hit
                hitVehicles.push(vehicle);
                hasCollided = true;
            } else if (poop.splashRadius > 0) {
                // Check for splash damage
                const dx = vehicle.x - poop.x;
                const dy = vehicle.y - poop.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= poop.splashRadius) {
                    hitVehicles.push(vehicle);
                    hasCollided = true;
                }
            }
        }
        
        // Second pass: handle all hit vehicles
        for (const vehicle of hitVehicles) {
            const wasHonking = vehicle.isHonking;
            const points = vehicle.handleHit(this.bird.getPowerUpState().powerUpLevel);
            
            // Add score based on honking state
            this.score = Math.max(0, this.score + points); // Ensure score doesn't go below 0
            
            // Create score animation at the hit location
            this.createScoreAnimation(poop.x, poop.y, points);
            
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
            this.createHitEffect(poop.x, poop.y, wasHonking);
        }
        
        // For single dropping type, keep it if it's still on screen and hasn't collided
        return !hasCollided && poop.y < this.canvas.height;
    }

    /**
     * Check for collisions between a poop and vehicles, but don't remove the poop
     * Used for laser type which should hit multiple vehicles
     * @param {Object} poop - The individual poop to check for collisions
     * @param {Object} parentDropping - The parent dropping object
     * @returns {boolean} true if any collision occurred
     * @private
     */
    checkPoopCollisionWithVehicles(poop, parentDropping) {
        // Check for collision with any vehicle
        let hasCollided = false;
        let hitVehicles = [];
        
        // First pass: identify all vehicles within splash radius
        for (const vehicle of this.vehicles) {
            if (vehicle.checkCollision(poop)) {
                // Direct hit
                hitVehicles.push(vehicle);
                hasCollided = true;
            } else if (poop.splashRadius > 0) {
                // Check for splash damage
                const dx = vehicle.x - poop.x;
                const dy = vehicle.y - poop.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= poop.splashRadius) {
                    hitVehicles.push(vehicle);
                    hasCollided = true;
                }
            }
        }
        
        // Second pass: handle all hit vehicles
        for (const vehicle of hitVehicles) {
            const wasHonking = vehicle.isHonking;
            const points = vehicle.handleHit(this.bird.getPowerUpState().powerUpLevel);
            
            // Add score based on honking state
            this.score = Math.max(0, this.score + points); // Ensure score doesn't go below 0
            
            // Create score animation at the hit location
            this.createScoreAnimation(poop.x, poop.y, points);
            
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
            this.createHitEffect(poop.x, poop.y, wasHonking);
        }
        
        // If this is a multi-type poop and it hit something, mark it as inactive
        // Laser poops stay active to hit multiple targets along their path
        if (hasCollided && parentDropping.type === 'multi' && poop.active) {
            poop.active = false;
        }
        
        return hasCollided;
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game };
} 