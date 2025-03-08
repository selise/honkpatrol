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
        this.vehiclesPerWave = 10; // Doubled from 5
        this.vehiclesSpawned = 0;
        this.waveTimer = 0;
        this.waveDuration = 30; // 30 seconds per wave
        
        // Initialize Vehicle class with starting wave
        Vehicle.setCurrentWave(this.wave);
        
        // Vehicle spawning
        this.vehicleSpawnTimer = 0;
        this.baseSpawnInterval = 2; // Initial seconds between vehicle spawns
        this.maxVehicles = 20; // Doubled from 10 to accommodate more vehicles
        
        // Emergency mode tracking (after crashes)
        this.emergencyMode = false;
        this.emergencyVehiclesRemaining = 0;
        
        // Food spawning
        this.foodSpawnTimer = 0;
        this.foodSpawnInterval = 10; // Seconds between food spawns
        this.maxFoods = 3; // Maximum number of food items allowed
        
        // Set up event listener for vehicle crashes
        if (typeof window !== 'undefined') {
            window.addEventListener('vehicleCrash', (event) => {
                this.enterEmergencyMode();
                
                // Create a special effect at the crash location
                if (event.detail && typeof event.detail.x === 'number' && typeof event.detail.y === 'number') {
                    // Add a more dramatic crash effect
                    this.createCrashEffect(event.detail.x, event.detail.y);
                }
            });
        }
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
        
        // If bird is dead, don't update anything else
        if (this.bird.isDead) {
            return;
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
        
        // Check for honking vehicles near the bird
        this.checkHonkingVehiclesNearBird();
        
        // Update food items
        this.foods = this.foods.filter(food => {
            // Update food animation and movement
            const foodActive = food.update(deltaTime);
            if (!foodActive) return false; // Remove food if it's no longer active
            
            // Check for collision with bird
            if (food.checkCollision(this.bird)) {
                // Bird ate the food
                this.bird.eatFood(food);
                
                // Create healing effect
                this.createHealEffect(food.x, food.y);
                
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
                const points = vehicle.handleHit(this.bird.getPowerUpState().powerUpLevel);
                
                // Add score based on honking state
                this.score = Math.max(0, this.score + points); // Ensure score doesn't go below 0
                
                // Create score animation at the hit location
                this.createScoreAnimation(dropping.x, dropping.y, points);
                
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
        
        // Update effects (like fire and healing animations)
        this.effects = this.effects.filter(effect => {
            return effect.update(deltaTime);
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
     * Checks if any honking vehicles are near the bird
     */
    checkHonkingVehiclesNearBird() {
        // Get bird position
        const birdPos = this.bird.getPosition();
        const birdX = birdPos.x + this.bird.width / 2;
        const birdY = birdPos.y + this.bird.height / 2;
        
        // Get effective wave number, capped at 3
        const effectiveWave = Math.min(this.wave, 3);
        
        // Base detection radius - scales with wave number (capped at wave 3)
        const baseRadius = 100; // Starting radius at wave 1
        const waveMultiplier = 1.0 + (effectiveWave - 1) * 0.2; // 20% increase per wave
        
        // Check each vehicle
        for (const vehicle of this.vehicles) {
            // Only check vehicles that are currently honking
            if (vehicle.isHonking) {
                // Calculate distance between bird and vehicle
                const dx = vehicle.x - birdX;
                const dy = vehicle.y - birdY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Apply different detection radius based on vehicle type
                let detectionRadius = baseRadius * waveMultiplier;
                
                // Emergency vehicles have 70% larger detection radius
                if (vehicle.type === 'emergency') {
                    detectionRadius *= 1.7;
                }
                
                // If the bird is within the scaled detection radius of a honking vehicle, damage it
                if (distance < detectionRadius) {
                    // Emergency vehicles cause more hearing damage
                    if (vehicle.type === 'emergency') {
                        // Double damage for emergency vehicles
                        this.bird.experienceHonk();
                        this.bird.experienceHonk();
                    } else {
                        this.bird.experienceHonk();
                    }
                }
            }
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
        this.vehiclesPerWave *= 2; // Double the number of vehicles each wave
        this.vehiclesSpawned = 0;
        this.waveTimer = 0;
        
        // Update the Vehicle class with the new wave number
        Vehicle.setCurrentWave(this.wave);
        
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
        
        // Draw game over screen if bird is dead
        if (this.bird.isDead) {
            this.drawGameOverScreen();
        }
    }
    
    /**
     * Gets the appropriate hearing health image based on health percentage
     * @param {number} healthPercent - Current health percentage (0-100)
     * @returns {HTMLImageElement|null} The appropriate image or null if not found
     */
    getHearingHealthImage(healthPercent) {
        // If assets aren't loaded yet, return null
        if (!assets || !assets.visuals || !assets.visuals.game || !assets.visuals.game.hearing_health) {
            return null;
        }
        
        // The available health levels
        const availableLevels = [10, 20, 30, 40, 50, 60, 70, 80, 100];
        
        // Find the appropriate image based on health percentage
        // We want the highest level that's less than or equal to the current health
        let selectedLevel = 10; // Default to lowest level
        
        for (const level of availableLevels) {
            if (healthPercent >= level) {
                selectedLevel = level;
            } else {
                break; // Stop once we find a level higher than current health
            }
        }
        
        // Return the corresponding image
        return assets.visuals.game.hearing_health[selectedLevel];
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
        
        // Draw health bar
        const healthBarWidth = 200;
        const healthBarHeight = 20;
        const healthBarX = 60; // Moved further right to make room for ear icon
        const healthBarY = this.canvas.height - 30;
        
        // Get current health percentage
        const healthPercent = this.bird.getHealthPercentage();
        
        // Draw appropriate hearing health image based on health percentage
        const hearingImage = this.getHearingHealthImage(healthPercent);
        
        if (hearingImage) {
            // Draw the appropriate hearing health image
            const earSize = 40;
            const earX = healthBarX - earSize - 5;
            const earY = healthBarY - (earSize - healthBarHeight) / 2;
            this.ctx.drawImage(hearingImage, earX, earY, earSize, earSize);
        } else if (assets && assets.visuals && assets.visuals.game && assets.visuals.game.bird_ears) {
            // Fallback to bird_ears.png if hearing health images aren't loaded
            const earImg = assets.visuals.game.bird_ears;
            const earSize = 40;
            const earX = healthBarX - earSize - 5;
            const earY = healthBarY - (earSize - healthBarHeight) / 2;
            this.ctx.drawImage(earImg, earX, earY, earSize, earSize);
        } else {
            // Final fallback to the simplified ear drawing if no images are loaded
            this.drawEarSymbol(healthBarX - 25, healthBarY + healthBarHeight/2);
        }
        
        // Health bar background
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        // Current health
        this.ctx.fillStyle = this.getHealthColor(healthPercent);
        this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * (healthPercent / 100), healthBarHeight);
        
        // Health bar border
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        
        // Health text
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`Hearing: ${Math.round(healthPercent)}%`, healthBarX + healthBarWidth / 2, healthBarY + healthBarHeight / 2 + 5);
        
        this.ctx.restore();
    }
    
    /**
     * Draws an ear symbol next to the health bar
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    drawEarSymbol(x, y) {
        this.ctx.save();
        
        // Make the ear larger and more visible
        const scale = 1.5;
        
        // Fill with a more noticeable color
        this.ctx.fillStyle = '#FF9966'; // Peachy color for the ear
        
        // Draw the outer ear shape
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - 10 * scale);
        this.ctx.bezierCurveTo(
            x + 15 * scale, y - 15 * scale, // Control point 1
            x + 20 * scale, y, // Control point 2
            x + 15 * scale, y + 10 * scale // End point
        );
        this.ctx.bezierCurveTo(
            x + 10 * scale, y + 5 * scale, // Control point 1
            x + 5 * scale, y, // Control point 2
            x, y - 10 * scale // End point (back to start)
        );
        this.ctx.fill(); // Fill first
        
        // Stroke with black outline after filling
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Inner ear detail
        this.ctx.beginPath();
        this.ctx.moveTo(x + 5 * scale, y - 5 * scale);
        this.ctx.bezierCurveTo(
            x + 12 * scale, y - 8 * scale, // Control point 1
            x + 15 * scale, y, // Control point 2
            x + 10 * scale, y + 5 * scale // End point
        );
        this.ctx.stroke();
        
        // Add a sound wave symbol coming into the ear
        this.ctx.beginPath();
        const waveX = x - 15;
        const waveSize = 6;
        this.ctx.arc(waveX, y, waveSize, 0.25 * Math.PI, 1.75 * Math.PI);
        this.ctx.arc(waveX, y, waveSize * 1.8, 1.75 * Math.PI, 0.25 * Math.PI, true);
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * Get color for health bar based on percentage
     * @param {number} percent - Health percentage
     * @returns {string} Color string
     */
    getHealthColor(percent) {
        if (percent > 60) {
            return 'rgba(0, 255, 0, 0.8)'; // Green for high health
        } else if (percent > 30) {
            return 'rgba(255, 255, 0, 0.8)'; // Yellow for medium health
        } else {
            return 'rgba(255, 0, 0, 0.8)'; // Red for low health
        }
    }

    /**
     * Activates emergency mode after a crash
     */
    enterEmergencyMode() {
        // Set emergency mode
        this.emergencyMode = true;
        this.emergencyVehiclesRemaining = 10;
        
        console.log("⚠️ CRASH DETECTED! Entering emergency mode. Next 10 vehicles will be emergency vehicles.");
    }
    
    /**
     * Spawns a new vehicle
     * @returns {Vehicle} The spawned vehicle
     */
    spawnVehicle() {
        // Create a new vehicle based on current mode
        let vehicle;
        
        if (this.emergencyMode && this.emergencyVehiclesRemaining > 0) {
            // Check for valid emergency vehicle sprites
            const leftSprites = assets.visuals.vehicles?.emergency_sprites?.left || [];
            const rightSprites = assets.visuals.vehicles?.emergency_sprites?.right || [];
            
            // Find valid sprite indices (non-null sprites)
            const validLeftIndices = [];
            const validRightIndices = [];
            
            for (let i = 0; i < leftSprites.length; i++) {
                if (leftSprites[i]) validLeftIndices.push(i);
            }
            
            for (let i = 0; i < rightSprites.length; i++) {
                if (rightSprites[i]) validRightIndices.push(i);
            }
            
            let emergencyDirection = null;
            let spriteIndex = null;
            
            // Determine if we can create an emergency vehicle and which direction to use
            if (validLeftIndices.length > 0 && validRightIndices.length > 0) {
                // Both directions are valid, choose randomly
                emergencyDirection = Math.random() < 0.5 ? 'left' : 'right';
                spriteIndex = emergencyDirection === 'left' 
                    ? validLeftIndices[Math.floor(Math.random() * validLeftIndices.length)]
                    : validRightIndices[Math.floor(Math.random() * validRightIndices.length)];
            } else if (validLeftIndices.length > 0) {
                // Only left direction is valid
                emergencyDirection = 'left';
                spriteIndex = validLeftIndices[Math.floor(Math.random() * validLeftIndices.length)];
            } else if (validRightIndices.length > 0) {
                // Only right direction is valid
                emergencyDirection = 'right';
                spriteIndex = validRightIndices[Math.floor(Math.random() * validRightIndices.length)];
            }
            
            if (emergencyDirection) {
                // Create the emergency vehicle with verified assets
                vehicle = new Vehicle(this.canvas.width, this.canvas.height);
                
                // Override the direction and sprite index
                vehicle.direction = emergencyDirection;
                vehicle.spriteIndex = spriteIndex;
                
                // Make sure the position is correct for the direction
                if (vehicle.direction === 'left') {
                    vehicle.x = this.canvas.width + vehicle.width / 2;
                    vehicle.speed = -(Math.random() * 100 + 50); // -150 to -50 pixels per second
                } else {
                    vehicle.x = -vehicle.width / 2;
                    vehicle.speed = Math.random() * 100 + 50; // 50 to 150 pixels per second
                }
                vehicle.originalSpeed = vehicle.speed;
                vehicle.targetSpeed = vehicle.speed;
                
                // Set the type to emergency
                vehicle.type = 'emergency';
            } else {
                // No valid emergency sprites found, create a regular vehicle
                vehicle = new Vehicle(this.canvas.width, this.canvas.height);
                console.warn('No valid emergency vehicle sprites found, spawning normal vehicle instead');
            }
            
            // Decrement counter
            this.emergencyVehiclesRemaining--;
            
            // Exit emergency mode when counter reaches zero
            if (this.emergencyVehiclesRemaining <= 0) {
                this.emergencyMode = false;
                console.log("Emergency response complete. Returning to normal traffic patterns.");
            }
        } else {
            // Create a normal vehicle (random type based on probabilities)
            vehicle = new Vehicle(this.canvas.width, this.canvas.height);
        }
        
        // Add to vehicles array
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
     * Draws the game over screen
     */
    drawGameOverScreen() {
        this.ctx.save();
        
        // Semi-transparent black overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Game over text
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 3);
        
        // Score
        this.ctx.font = '32px Arial';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
        
        // Wave reached
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Wave Reached: ${this.wave}`, this.canvas.width / 2, this.canvas.height / 2 + 50);
        
        // Restart instructions
        this.ctx.font = '18px Arial';
        this.ctx.fillText('Refresh the page to play again', this.canvas.width / 2, this.canvas.height * 3/4);
        
        this.ctx.restore();
    }

    /**
     * Creates a healing visual effect
     * @param {number} x - X position of the effect
     * @param {number} y - Y position of the effect
     */
    createHealEffect(x, y) {
        this.effects.push({
            x: x,
            y: y,
            radius: 20,
            color: '#00FF00', // Green for healing
            lifetime: 0.7, // seconds
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
                ctx.arc(this.x, this.y, this.radius * (1 + this.timer / this.lifetime * 2), 0, Math.PI * 2);
                ctx.fill();
                
                // Draw plus sign in the middle
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.beginPath();
                
                // Horizontal line
                ctx.moveTo(this.x - 10, this.y);
                ctx.lineTo(this.x + 10, this.y);
                
                // Vertical line
                ctx.moveTo(this.x, this.y - 10);
                ctx.lineTo(this.x, this.y + 10);
                
                ctx.stroke();
                ctx.restore();
            }
        });
        
        // Play healing sound if available
        if (assets && assets.sounds && assets.sounds.effects && assets.sounds.effects.powerup) {
            // Use powerup sound for healing
            const sound = assets.sounds.effects.powerup;
            sound.currentTime = 0;
            sound.play().catch(e => console.warn('Could not play healing sound:', e));
        }
    }

    /**
     * Creates a visual effect for a vehicle crash
     * @param {number} x - X position of the crash
     * @param {number} y - Y position of the crash
     */
    createCrashEffect(x, y) {
        // Create multiple explosion effects for a more dramatic crash
        for (let i = 0; i < 3; i++) {
            // Random offset for each explosion
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 20;
            
            // Create explosion with random size and duration
            this.effects.push({
                x: x + offsetX,
                y: y + offsetY,
                radius: 30 + Math.random() * 20, // 30-50 pixel radius
                color: `rgba(${200 + Math.random() * 55}, ${100 + Math.random() * 50}, 0, 0.8)`, // Orange-red
                lifetime: 0.8 + Math.random() * 0.4, // 0.8-1.2 seconds
                timer: 0,
                update: function(deltaTime) {
                    this.timer += deltaTime;
                    return this.timer < this.lifetime;
                },
                draw: function(ctx) {
                    // Calculate opacity based on remaining lifetime
                    const opacity = Math.max(0, 1 - (this.timer / this.lifetime));
                    
                    // Draw expanding circle with fading opacity
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
        
        // Play a crash sound if available
        if (assets && assets.sounds && assets.sounds.effects && assets.sounds.effects.crash) {
            assets.sounds.effects.crash.currentTime = 0;
            assets.sounds.effects.crash.play();
        }
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game };
} 