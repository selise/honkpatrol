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
        
        // Initialize background elements
        this.initializeBackgroundElements();
        
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
     * Initialize the fixed background elements to prevent flickering
     */
    initializeBackgroundElements() {
        // Define fixed lane positions with 6 lanes (4 regular + 2 emergency)
        this.fixedLaneData = {
            laneStartY: this.canvas.height / 2 - 75, // Position road in middle with more sky view
            laneHeight: 40, // Slightly smaller lanes to fit 6 lanes
            totalLanes: 6  // 6 lanes total (4 regular + 2 emergency)
        };
        
        // Pre-generate cloud positions for the sky
        this.clouds = [];
        const numClouds = 8;
        
        for (let i = 0; i < numClouds; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * (this.fixedLaneData.laneStartY - 50),
                width: 60 + Math.random() * 40,
                height: 30 + Math.random() * 20,
                opacity: 0.5 + Math.random() * 0.3
            });
        }
        
        // Pre-generate grass tufts to prevent flickering
        this.grassTufts = [];
        const roadEndY = this.fixedLaneData.laneStartY + (this.fixedLaneData.laneHeight * this.fixedLaneData.totalLanes);
        const numTufts = Math.floor(this.canvas.width / 15);
        
        for (let i = 0; i < numTufts; i++) {
            const x = i * 15 + (Math.random() * 10 - 5);
            const height = 5 + Math.random() * 10;
            const greenValue = 100 + Math.floor(Math.random() * 155);
            
            this.grassTufts.push({
                x: x,
                height: height,
                color: `rgb(0, ${greenValue}, 0)`
            });
        }
    }
    
    /**
     * Pre-generate road texture data to avoid randomness each frame
     */
    generateRoadTextureData(y, height) {
        const texturePoints = [];
        
        for (let i = 0; i < height; i += 2) {
            for (let j = 0; j < this.canvas.width; j += 2) {
                if (Math.random() < 0.1) {
                    texturePoints.push({x: j, y: y + i});
                }
            }
        }
        
        return texturePoints;
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
        
        // Draw all background elements first
        this.drawBackground();
        
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
     * Draws all static background elements in a fixed order
     */
    drawBackground() {
        const { laneStartY, laneHeight, totalLanes } = this.fixedLaneData;
        const roadHeight = laneHeight * totalLanes;
        const roadEndY = laneStartY + roadHeight;
        
        // 1. SKY SPACE - Draw blue sky with clouds
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, laneStartY);
        skyGradient.addColorStop(0, '#64b5f6'); // Lighter blue at top
        skyGradient.addColorStop(1, '#bbdefb'); // Slightly lighter blue at horizon
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, laneStartY);
        
        // Draw clouds
        this.drawClouds();
        
        // 2. ROAD SPACE - Draw road with gradient for depth effect
        const roadGradient = this.ctx.createLinearGradient(0, laneStartY, 0, roadEndY);
        roadGradient.addColorStop(0, '#4a4a4a'); // Darker at top
        roadGradient.addColorStop(1, '#666666'); // Lighter at bottom
        
        this.ctx.fillStyle = roadGradient;
        this.ctx.fillRect(0, laneStartY, this.canvas.width, roadHeight);
        
        // Draw road edges - top and bottom of entire road area
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, laneStartY);
        this.ctx.lineTo(this.canvas.width, laneStartY);
        this.ctx.moveTo(0, roadEndY);
        this.ctx.lineTo(this.canvas.width, roadEndY);
        this.ctx.stroke();
        
        // 3. Draw lane separators
        this.drawLaneSeparators();
        
        // 4. BOTTOM SPACE - Draw grass
        this.drawGrass(roadEndY);
    }
    
    /**
     * Draw clouds in the sky
     */
    drawClouds() {
        this.ctx.fillStyle = '#ffffff';
        
        for (const cloud of this.clouds) {
            this.ctx.save();
            this.ctx.globalAlpha = cloud.opacity;
            
            // Draw a fluffy cloud using multiple overlapping circles
            const centerX = cloud.x;
            const centerY = cloud.y;
            const width = cloud.width;
            const height = cloud.height;
            
            // Base oval
            this.ctx.beginPath();
            this.ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Additional "puffs"
            const numPuffs = 5;
            const puffRadius = height / 2;
            
            for (let i = 0; i < numPuffs; i++) {
                const angle = (i / numPuffs) * Math.PI;
                const puffX = centerX + Math.cos(angle) * (width / 2 - puffRadius / 2);
                const puffY = centerY + Math.sin(angle) * (height / 3);
                
                this.ctx.beginPath();
                this.ctx.arc(puffX, puffY, puffRadius, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }
    }
    
    /**
     * Draw lane separators with specified styles
     */
    drawLaneSeparators() {
        const { laneStartY, laneHeight, totalLanes } = this.fixedLaneData;
        
        for (let i = 1; i < totalLanes; i++) {
            const y = laneStartY + (i * laneHeight);
            
            if (i === 1) {
                // Straight white line between emergency bottom lane and first regular lane
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            } else {
                // Dotted white lines between all other lanes
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([15, 10]); // 15px dash, 10px gap
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
                this.ctx.setLineDash([]); // Reset to solid line
            }
        }
    }
    
    /**
     * Draw grass in the bottom area
     */
    drawGrass(startY) {
        // Fill the grass area with a green gradient
        const grassGradient = this.ctx.createLinearGradient(0, startY, 0, this.canvas.height);
        grassGradient.addColorStop(0, '#4CAF50');  // Darker green at top
        grassGradient.addColorStop(1, '#81C784');  // Lighter green at bottom
        
        this.ctx.fillStyle = grassGradient;
        this.ctx.fillRect(0, startY, this.canvas.width, this.canvas.height - startY);
        
        // Draw pre-computed grass texture/pattern
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        
        // Use pre-generated grass tufts to avoid flickering
        for (const tuft of this.grassTufts) {
            this.ctx.fillStyle = tuft.color;
            
            this.ctx.beginPath();
            this.ctx.moveTo(tuft.x, startY);
            this.ctx.lineTo(tuft.x - 5, startY + tuft.height);
            this.ctx.lineTo(tuft.x, startY + tuft.height / 2);
            this.ctx.lineTo(tuft.x + 5, startY + tuft.height);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    /**
     * Draws the pre-calculated road texture to prevent flickering
     */
    drawStoredRoadTexture() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.1;
        this.ctx.fillStyle = '#ffffff';
        
        for (const point of this.roadTextureData) {
            this.ctx.fillRect(point.x, point.y, 2, 2);
        }
        
        this.ctx.restore();
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
        
        // Common styling variables
        const cornerRadius = 4;
        const textShadow = true;
        
        // Common UI element dimensions to match the health bar
        const elementWidth = 150; // Match health bar width
        const elementHeight = 15; // Match health bar height
        const elementFont = 'bold 12px Arial'; // Match health bar font
        
        // ============= SCORE DISPLAY =============
        const scoreX = 10;
        const scoreY = 10;
        
        // Draw drop shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.roundRect(scoreX + 2, scoreY + 2, elementWidth, elementHeight, cornerRadius);
        
        // Draw background with gradient
        const scoreGradient = this.ctx.createLinearGradient(scoreX, scoreY, scoreX, scoreY + elementHeight);
        scoreGradient.addColorStop(0, 'rgba(30, 30, 60, 0.8)');
        scoreGradient.addColorStop(1, 'rgba(10, 10, 40, 0.8)');
        this.ctx.fillStyle = scoreGradient;
        this.roundRect(scoreX, scoreY, elementWidth, elementHeight, cornerRadius);
        
        // Add highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(scoreX + 2, scoreY + 2, elementWidth - 4, 2);
        
        // Draw score text with shadow
        if (textShadow) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            this.ctx.shadowBlur = 3;
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
        }
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = elementFont;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, scoreX + 10, scoreY + elementHeight / 2 + 4);
        
        // Reset shadow
        if (textShadow) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        }
        
        // ============= POWER LEVEL DISPLAY =============
        const powerX = 10;
        const powerY = scoreY + elementHeight + 10;
        const powerState = this.bird.getPowerUpState();
        
        // Draw drop shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.roundRect(powerX + 2, powerY + 2, elementWidth, elementHeight, cornerRadius);
        
        // Draw background with gradient based on power level
        const powerGradient = this.ctx.createLinearGradient(powerX, powerY, powerX, powerY + elementHeight);
        
        // Different gradients based on power level
        if (powerState.powerUpLevel >= 3) {
            powerGradient.addColorStop(0, 'rgba(128, 0, 128, 0.8)'); // Purple for high power
            powerGradient.addColorStop(1, 'rgba(75, 0, 130, 0.8)');
        } else if (powerState.powerUpLevel >= 2) {
            powerGradient.addColorStop(0, 'rgba(0, 0, 200, 0.8)'); // Blue for medium power
            powerGradient.addColorStop(1, 'rgba(0, 0, 150, 0.8)');
        } else {
            powerGradient.addColorStop(0, 'rgba(50, 50, 100, 0.8)'); // Default blue-gray
            powerGradient.addColorStop(1, 'rgba(30, 30, 70, 0.8)');
        }
        
        this.ctx.fillStyle = powerGradient;
        this.roundRect(powerX, powerY, elementWidth, elementHeight, cornerRadius);
        
        // Add highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(powerX + 2, powerY + 2, elementWidth - 4, 2);
        
        // Draw power level text with shadow
        if (textShadow) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            this.ctx.shadowBlur = 3;
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
        }
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = elementFont;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Power: ${powerState.powerUpLevel}`, powerX + 10, powerY + elementHeight / 2 + 4);
        
        // Reset shadow
        if (textShadow) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        }
        
        // ============= WAVE DISPLAY =============
        const waveX = (this.canvas.width - elementWidth) / 2;
        const waveY = 10;
        
        // Draw drop shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.roundRect(waveX + 2, waveY + 2, elementWidth, elementHeight, cornerRadius);
        
        // Draw background with gradient
        const waveGradient = this.ctx.createLinearGradient(waveX, waveY, waveX, waveY + elementHeight);
        waveGradient.addColorStop(0, 'rgba(60, 30, 30, 0.8)'); // Reddish brown gradient
        waveGradient.addColorStop(1, 'rgba(40, 10, 10, 0.8)');
        this.ctx.fillStyle = waveGradient;
        this.roundRect(waveX, waveY, elementWidth, elementHeight, cornerRadius);
        
        // Add highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(waveX + 2, waveY + 2, elementWidth - 4, 2);
        
        // Draw wave text with shadow
        if (textShadow) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            this.ctx.shadowBlur = 3;
            this.ctx.shadowOffsetX = 1;
            this.ctx.shadowOffsetY = 1;
        }
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = elementFont;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Wave: ${this.wave}`, waveX + elementWidth / 2, waveY + elementHeight / 2 + 4);
        
        // Reset shadow
        if (textShadow) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        }
        
        // Draw wave progress bar below the wave display
        const waveProgressWidth = 160;
        const waveProgressHeight = 8;
        const waveProgressX = (this.canvas.width - waveProgressWidth) / 2;
        const waveProgressY = waveY + elementHeight + 5;
        
        // Progress background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.roundRect(waveProgressX, waveProgressY, waveProgressWidth, waveProgressHeight, waveProgressHeight / 2);
        
        // Progress fill
        const progress = Math.min(1, this.waveTimer / this.waveDuration);
        
        if (progress > 0) {
            const progressGradient = this.ctx.createLinearGradient(
                waveProgressX, waveProgressY, 
                waveProgressX, waveProgressY + waveProgressHeight
            );
            progressGradient.addColorStop(0, 'rgba(255, 170, 70, 0.9)'); // Orange-gold gradient
            progressGradient.addColorStop(1, 'rgba(200, 120, 20, 0.9)');
            
            this.ctx.fillStyle = progressGradient;
            this.roundRect(waveProgressX, waveProgressY, waveProgressWidth * progress, waveProgressHeight, waveProgressHeight / 2);
            
            // Add highlight
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fillRect(waveProgressX + 2, waveProgressY + 1, (waveProgressWidth * progress) - 4, 2);
        }
        
        // Health bar styling enhancements
        const healthBarWidth = 150;
        const healthBarHeight = 15;
        const healthBarX = this.canvas.width - 160;
        const healthBarY = 30;
        
        // Get current health percentage
        const healthPercent = this.bird.getHealthPercentage();
        
        // Draw appropriate hearing health image based on health percentage
        const hearingImage = this.getHearingHealthImage(healthPercent);
        
        if (hearingImage) {
            // Draw the appropriate hearing health image - now centered above the health bar
            const earSize = 40;
            // Center the ear icon horizontally over the health bar
            const earX = healthBarX + (healthBarWidth / 2) - (earSize / 2);
            // Position the ear icon above the health bar
            const earY = healthBarY - earSize - 2; // 2px gap between icon and bar
            this.ctx.drawImage(hearingImage, earX, earY, earSize, earSize);
        } else if (assets && assets.visuals && assets.visuals.game && assets.visuals.game.bird_ears) {
            // Fallback to bird_ears.png if hearing health images aren't loaded
            const earImg = assets.visuals.game.bird_ears;
            const earSize = 40;
            // Center the ear icon horizontally over the health bar
            const earX = healthBarX + (healthBarWidth / 2) - (earSize / 2);
            // Position the ear icon above the health bar
            const earY = healthBarY - earSize - 2; // 2px gap between icon and bar
            this.ctx.drawImage(earImg, earX, earY, earSize, earSize);
        } else {
            // Final fallback to the simplified ear drawing if no images are loaded
            // Center the ear symbol horizontally over the health bar
            const earX = healthBarX + (healthBarWidth / 2);
            // Position the ear symbol above the health bar
            const earY = healthBarY - 15; // Smaller offset for the drawn ear
            this.drawEarSymbol(earX, earY);
        }
        
        // Draw drop shadow for depth
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.roundRect(healthBarX + 2, healthBarY + 2, healthBarWidth, healthBarHeight, cornerRadius);
        
        // Outer container with gradient
        const containerGradient = this.ctx.createLinearGradient(
            healthBarX, healthBarY, 
            healthBarX, healthBarY + healthBarHeight
        );
        containerGradient.addColorStop(0, 'rgba(40, 40, 40, 0.8)');
        containerGradient.addColorStop(1, 'rgba(20, 20, 20, 0.8)');
        this.ctx.fillStyle = containerGradient;
        this.roundRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight, cornerRadius);
        
        // Health bar fill with gradient
        if (healthPercent > 0) {
            const barWidth = healthBarWidth * (healthPercent / 100);
            const healthGradient = this.ctx.createLinearGradient(
                healthBarX, healthBarY, 
                healthBarX, healthBarY + healthBarHeight
            );
            
            if (healthPercent > 60) {
                // Good health - green gradient
                healthGradient.addColorStop(0, '#5fea5f');
                healthGradient.addColorStop(1, '#3cb371');
            } else if (healthPercent > 30) {
                // Medium health - yellow/orange gradient
                healthGradient.addColorStop(0, '#ffd700');
                healthGradient.addColorStop(1, '#ffa500');
            } else {
                // Low health - red gradient with pulsing effect
                const pulseIntensity = 0.7 + 0.3 * Math.sin(Date.now() / 200); // Subtle pulsing effect
                healthGradient.addColorStop(0, `rgba(255, ${Math.floor(60 * pulseIntensity)}, ${Math.floor(60 * pulseIntensity)}, 1)`);
                healthGradient.addColorStop(1, `rgba(220, ${Math.floor(20 * pulseIntensity)}, ${Math.floor(20 * pulseIntensity)}, 1)`);
            }
            
            this.ctx.fillStyle = healthGradient;
            this.roundRect(healthBarX, healthBarY, barWidth, healthBarHeight, cornerRadius);
            
            // Add highlight at the top for 3D effect
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(healthBarX + 2, healthBarY + 2, barWidth - 4, 2);
        }
        
        // Health text
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 12px Arial';
        
        // Add text shadow for better readability
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 3;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.fillText(`Hearing: ${Math.round(healthPercent)}%`, healthBarX + healthBarWidth / 2, healthBarY + healthBarHeight / 2 + 4);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
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
     * Draws trees along the side of the road with more variety
     * @param {number} x - X position to start drawing trees
     * @param {number} y - Y position to start drawing trees
     * @param {number} height - Height of the tree area
     * @param {string} side - Which side of the road ('left' or 'right')
     * @param {number} rowType - Type of tree row (0 for primary, 1 for secondary)
     */
    drawTrees(x, y, height, side, rowType = 0) {
        const treeSpacing = rowType === 0 ? 70 : 90; // Closer spacing for primary row
        const numTrees = Math.floor(height / treeSpacing) + 2; // Add more trees
        const treeTypes = ['pine', 'round', 'palm', 'banyan']; // Different tree types
        
        for (let i = 0; i < numTrees; i++) {
            const treeY = y + (i * treeSpacing) + (Math.random() * 20 - 10); // Add variation to Y position
            const treeOffset = side === 'left' ? 1 : -1; // Adjust for side
            const treeX = x + (Math.random() * 15 - 7.5) * treeOffset; // Add variation to X position
            
            // Randomly select tree type
            const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
            
            // Scale factor for size variation
            const scale = 0.8 + Math.random() * 0.4;
            
            // Draw tree based on type
            switch (treeType) {
                case 'pine':
                    this.drawPineTree(treeX, treeY, scale);
                    break;
                case 'round':
                    this.drawRoundTree(treeX, treeY, scale);
                    break;
                case 'palm':
                    this.drawPalmTree(treeX, treeY, scale);
                    break;
                case 'banyan':
                    this.drawBanyanTree(treeX, treeY, scale);
                    break;
            }
        }
    }
    
    /**
     * Draws a pine tree
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} scale - Size scale factor
     */
    drawPineTree(x, y, scale) {
        const trunkWidth = 8 * scale;
        const trunkHeight = 30 * scale;
        const leafWidth = 30 * scale;
        const leafHeight = 50 * scale;
            
            // Draw tree trunk
        this.ctx.fillStyle = '#5D4037';
        this.ctx.fillRect(x - trunkWidth/2, y, trunkWidth, trunkHeight);
        
        // Draw tree leaves (triangle shapes, 3 layers)
        this.ctx.fillStyle = '#2E7D32';
        
        // Bottom layer (largest)
            this.ctx.beginPath();
        this.ctx.moveTo(x - leafWidth, y);
        this.ctx.lineTo(x + leafWidth, y);
        this.ctx.lineTo(x, y - leafHeight * 0.6);
            this.ctx.closePath();
            this.ctx.fill();
            
        // Middle layer
        this.ctx.beginPath();
        this.ctx.moveTo(x - leafWidth * 0.8, y - leafHeight * 0.4);
        this.ctx.lineTo(x + leafWidth * 0.8, y - leafHeight * 0.4);
        this.ctx.lineTo(x, y - leafHeight * 0.9);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Top layer (smallest)
        this.ctx.beginPath();
        this.ctx.moveTo(x - leafWidth * 0.6, y - leafHeight * 0.7);
        this.ctx.lineTo(x + leafWidth * 0.6, y - leafHeight * 0.7);
        this.ctx.lineTo(x, y - leafHeight);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    /**
     * Draws a round canopy tree
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} scale - Size scale factor
     */
    drawRoundTree(x, y, scale) {
        const trunkWidth = 8 * scale;
        const trunkHeight = 35 * scale;
        const canopyRadius = 25 * scale;
        
        // Draw tree trunk
        this.ctx.fillStyle = '#5D4037';
        this.ctx.fillRect(x - trunkWidth/2, y, trunkWidth, trunkHeight);
        
        // Draw tree canopy (circle)
        this.ctx.fillStyle = '#388E3C';
        this.ctx.beginPath();
        this.ctx.arc(x, y - canopyRadius * 0.5, canopyRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add highlight for 3D effect
        this.ctx.fillStyle = '#43A047';
        this.ctx.beginPath();
        this.ctx.arc(x + 5, y - canopyRadius * 0.6, canopyRadius * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * Draws a palm tree (more tropical style) using pre-calculated data
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} scale - Size scale factor
     * @param {Array} palmLeafData - Pre-calculated palm leaf positions and angles
     */
    drawPalmTree(x, y, scale, palmLeafData) {
        const trunkWidth = 6 * scale;
        const trunkHeight = 50 * scale;
        const leafLength = 30 * scale;
        
        // Draw curved trunk
        this.ctx.strokeStyle = '#8D6E63';
        this.ctx.lineWidth = trunkWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + trunkHeight);
        this.ctx.bezierCurveTo(
            x, y + trunkHeight * 0.7,
            x + 10 * scale, y + trunkHeight * 0.3,
            x + 5 * scale, y
        );
        this.ctx.stroke();
        
        // Draw palm leaves using pre-calculated data
        this.ctx.fillStyle = '#66BB6A';
        
        if (palmLeafData) {
            // Use pre-calculated leaf data
            for (const leaf of palmLeafData) {
                const leafX = x + 5 * scale + leaf.leafX;
                const leafY = y + leaf.leafY;
                
                this.ctx.save();
                this.ctx.translate(leafX, leafY);
                this.ctx.rotate(leaf.angle);
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.bezierCurveTo(
                    leafLength * 0.3, -5 * scale,
                    leafLength * 0.7, -8 * scale,
                    leafLength, 0
                );
                this.ctx.bezierCurveTo(
                    leafLength * 0.7, 8 * scale,
                    leafLength * 0.3, 5 * scale,
                    0, 0
                );
                this.ctx.fill();
                
                this.ctx.restore();
            }
        } else {
            // Fallback to fixed pattern for older tree objects without pre-calculated data
            const numLeaves = 6;
            for (let i = 0; i < numLeaves; i++) {
                const angle = (i / numLeaves) * Math.PI * 2;
                const leafX = x + 5 * scale + Math.cos(angle) * 5;
                const leafY = y + Math.sin(angle) * 5;
                
                this.ctx.save();
                this.ctx.translate(leafX, leafY);
                this.ctx.rotate(angle);
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.bezierCurveTo(
                    leafLength * 0.3, -5 * scale,
                    leafLength * 0.7, -8 * scale,
                    leafLength, 0
                );
                this.ctx.bezierCurveTo(
                    leafLength * 0.7, 8 * scale,
                    leafLength * 0.3, 5 * scale,
                    0, 0
                );
                this.ctx.fill();
                
                this.ctx.restore();
            }
        }
    }
    
    /**
     * Draws a banyan style tree (inspired by South Asian trees)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} scale - Size scale factor
     */
    drawBanyanTree(x, y, scale) {
        const trunkWidth = 12 * scale;
        const trunkHeight = 30 * scale;
        const canopyWidth = 50 * scale;
        const canopyHeight = 40 * scale;
        
        // Draw main trunk
        this.ctx.fillStyle = '#5D4037';
        this.ctx.fillRect(x - trunkWidth/2, y, trunkWidth, trunkHeight);
        
        // Draw aerial roots on sides
        const numRoots = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numRoots; i++) {
            const rootOffset = (i / numRoots - 0.5) * trunkWidth * 2;
            const rootX = x + rootOffset;
            const rootY = y + trunkHeight * 0.4;
            const rootHeight = trunkHeight * 0.6;
            
            this.ctx.fillStyle = '#6D4C41';
            this.ctx.fillRect(rootX - 2 * scale, rootY, 4 * scale, rootHeight);
        }
        
        // Draw wide, layered canopy
        this.ctx.fillStyle = '#1B5E20';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - canopyHeight * 0.3, canopyWidth, canopyHeight * 0.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw second layer of canopy
        this.ctx.fillStyle = '#2E7D32';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - canopyHeight * 0.6, canopyWidth * 0.8, canopyHeight * 0.4, 0, 0, Math.PI * 2);
        this.ctx.fill();
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

    // Add helper method for drawing rounded rectangles if it doesn't exist
    roundRect(x, y, width, height, radius) {
        if (radius === 0) {
            this.ctx.fillRect(x, y, width, height);
            return;
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Renders the stored buildings (to prevent flickering)
     */
    renderStoredBuildings() {
        for (const building of this.buildings) {
            this.drawSubcontinentalBuilding(
                building.x, 
                building.y, 
                building.width, 
                building.height, 
                building.type, 
                building.baseColor, 
                building.trimColor
            );
        }
    }
    
    /**
     * Renders the stored trees (to prevent flickering)
     */
    renderStoredTrees() {
        // Draw left side trees
        for (const tree of this.trees.left) {
            switch (tree.type) {
                case 'pine':
                    this.drawPineTree(tree.x, tree.y, tree.scale);
                    break;
                case 'round':
                    this.drawRoundTree(tree.x, tree.y, tree.scale);
                    break;
                case 'palm':
                    this.drawPalmTree(tree.x, tree.y, tree.scale, tree.palmLeafData);
                    break;
                case 'banyan':
                    this.drawBanyanTree(tree.x, tree.y, tree.scale);
                    break;
            }
        }
        
        // Draw right side trees
        for (const tree of this.trees.right) {
            switch (tree.type) {
                case 'pine':
                    this.drawPineTree(tree.x, tree.y, tree.scale);
                    break;
                case 'round':
                    this.drawRoundTree(tree.x, tree.y, tree.scale);
                    break;
                case 'palm':
                    this.drawPalmTree(tree.x, tree.y, tree.scale, tree.palmLeafData);
                    break;
                case 'banyan':
                    this.drawBanyanTree(tree.x, tree.y, tree.scale);
                    break;
            }
        }
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game };
} 