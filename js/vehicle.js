/**
 * Represents a vehicle in the game
 * @class
 */
class Vehicle {
    // Static property to track active honk sounds
    static activeHonkSounds = 0;
    static MAX_CONCURRENT_HONKS = 3;
    
    // Static property for the current wave (will be updated by the Game class)
    static currentWave = 1;
    
    // Static method to update the current wave
    static setCurrentWave(wave) {
        Vehicle.currentWave = Math.max(1, wave);
    }
    
    /**
     * Static method to check if assets exist for a given vehicle type and direction
     * @param {string} type - The vehicle type
     * @param {string} direction - The direction ('left' or 'right')
     * @param {number} spriteIndex - Optional specific sprite index to check
     * @returns {boolean} - Whether assets exist for this vehicle type and direction
     */
    static hasAssets(type, direction, spriteIndex = null) {
        if (!assets.visuals.vehicles) return false;
        if (!assets.visuals.vehicles[`${type}_sprites`]) return false;
        if (!assets.visuals.vehicles[`${type}_sprites`][direction]) return false;
        if (!assets.visuals.vehicles[`${type}_sprites`][direction].length) return false;
        
        const spriteArray = assets.visuals.vehicles[`${type}_sprites`][direction];
        
        // If a specific sprite index is requested, check just that one
        if (spriteIndex !== null) {
            return spriteIndex < spriteArray.length && !!spriteArray[spriteIndex];
        }
        
        // Otherwise, check if at least one sprite exists that isn't null or undefined
        return spriteArray.some(sprite => !!sprite);
    }
    
    /**
     * Creates a new Vehicle instance
     * @param {number} canvasWidth - Width of the game canvas
     * @param {number} canvasHeight - Height of the game canvas
     */
    constructor(canvasWidth, canvasHeight) {
        // Set canvas dimensions for reference
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Randomly select direction first (needed for asset checking)
        this.direction = Math.random() < 0.5 ? 'left' : 'right';
        
        // Possible vehicle types
        const types = ['car', 'truck', 'bus', 'emergency'];
        
        // Try up to 10 times to find a valid vehicle type and sprite
        let validVehicleFound = false;
        let attempts = 0;
        
        while (!validVehicleFound && attempts < 10) {
            // Filter types to only include those with valid assets
            const validTypes = types.filter(type => Vehicle.hasAssets(type, this.direction));
            
            if (validTypes.length === 0) {
                // Try the other direction if no valid types for this direction
                this.direction = this.direction === 'left' ? 'right' : 'left';
                attempts++;
                continue;
            }
            
            // Randomly select from valid types
            this.type = validTypes[Math.floor(Math.random() * validTypes.length)];
            
            // Get sprite array for this type and direction
            const spriteArray = assets.visuals.vehicles[`${this.type}_sprites`][this.direction];
            
            // Find all valid sprite indices (non-null sprites)
            const validSpriteIndices = [];
            for (let i = 0; i < spriteArray.length; i++) {
                if (spriteArray[i]) {
                    validSpriteIndices.push(i);
                }
            }
            
            if (validSpriteIndices.length === 0) {
                // No valid sprites for this type and direction
                attempts++;
                continue;
            }
            
            // Select a random valid sprite
            this.spriteIndex = validSpriteIndices[Math.floor(Math.random() * validSpriteIndices.length)];
            validVehicleFound = true;
        }
        
        // If we couldn't find a valid vehicle after multiple attempts, use console error
        // This should never happen in a properly set up game
        if (!validVehicleFound) {
            console.error("Failed to find valid vehicle type and sprite after multiple attempts");
            
            // Default to a known type and direction
            this.type = 'car';
            this.direction = 'right';
            this.spriteIndex = 0;
        }
        
        // Pre-calculate and store vehicle dimensions to avoid repeated calculations
        this.calculateVehicleDimensions();
        
        // Define lanes
        this.totalLanes = 6; // Total number of lanes on the road (including emergency lanes)
        this.laneHeight = 30; // Reduced from 60 to 30
        this.laneStartY = this.canvasHeight - (this.totalLanes * this.laneHeight) - 50; // Start from bottom, leaving 50px for ground
        
        // Assign a lane from the central 3 lanes (lanes 2-4, index 1-3)
        // Keeping lanes 0 and 5 as emergency lanes and not using lane 4 (bottom regular lane)
        this.lane = Math.floor(Math.random() * 3) + 1;
        
        // Set Y position based on lane
        this.y = this.laneStartY + (this.lane * this.laneHeight) + (this.laneHeight / 2);
        
        // Set starting position based on direction
        if (this.direction === 'left') {
            // Start from right side, moving left
            this.x = canvasWidth + this.width / 2;
            this.speed = -(Math.random() * 100 + 50); // -150 to -50 pixels per second
        } else {
            // Start from left side, moving right
            this.x = -this.width / 2;
            this.speed = Math.random() * 100 + 50; // 50 to 150 pixels per second
        }
        
        // Store original speed for returning to normal speed after slowdown
        this.originalSpeed = this.speed;
        // Target speed for smooth acceleration/deceleration
        this.targetSpeed = this.speed;
        // Speed change rate (pixels per second per second)
        this.acceleration = 100;
        // Flag to track if vehicle is in slowdown mode
        this.isSlowingDown = false;
        
        // Collision and crash state
        this.hasCrashed = false;
        this.crashTimer = 0;
        this.crashDuration = 3.0; // seconds
        this.fire = null;
        
        // Poop hit state
        this.hitByPoop = false;
        this.hitTimer = 0;
        this.hitDuration = 3.0; // seconds before disappearing after being hit
        
        // Collision avoidance
        this.targetLane = null;
        this.laneChangeProgress = 0;
        this.laneChangeSpeed = 1.0; // Time to complete lane change in seconds
        
        // Honking properties - reduced chance of honking by 15%
        this.isHonking = Math.random() < 0.255; // Reduced from 30% to 25.5% chance (15% reduction)
        this.honkInterval = 1.0; // seconds between honk sounds while honking
        this.lastHonkTime = 0; // track last honk time
        this.honkAnimationTimer = 0; // timer for honk animation
        this.currentlyPlayingHonk = null; // reference to active audio
        this.honkGracePeriod = 10.0; // seconds to consider vehicle as honking after last honk
        
        // Calculate initial position
        this.originalY = this.y;
        this.targetY = this.y;
        
        // Sound waves for honking animation
        this.soundWaves = [];
        
        // Honking properties
        this.honkDuration = Math.random() * 2 + 1; // Random duration between 1-3 seconds
        this.honkTimer = 0;
        this.honkCooldown = 0;
    }
    
    /**
     * Calculate and store vehicle dimensions based on sprite
     * This prevents dimensions from being recalculated every frame
     */
    calculateVehicleDimensions() {
        // Use a fixed height for all vehicles to fit properly in lanes
        const standardHeight = 30;
        this.height = standardHeight;
        
        // Get sprite to determine aspect ratio
        const spriteArray = assets.visuals.vehicles[`${this.type}_sprites`][this.direction];
        
        if (spriteArray && spriteArray.length > 0 && this.spriteIndex < spriteArray.length) {
            const sprite = spriteArray[this.spriteIndex];
            
            if (sprite) {
                // Calculate width based on the sprite's aspect ratio and our fixed height
                const aspectRatio = sprite.width / sprite.height;
                this.width = standardHeight * aspectRatio;
                
                // Set reasonable minimum and maximum widths
                if (this.width < 40) this.width = 40; // Minimum width
                if (this.width > 120) this.width = 120; // Maximum width
            } else {
                // Fallback width if sprite is unavailable
                this.setDefaultWidth();
            }
        } else {
            // Fallback width if sprite array is unavailable
            this.setDefaultWidth();
        }
        
        // Store half dimensions for more efficient collision detection
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
    }
    
    /**
     * Sets default width based on vehicle type
     */
    setDefaultWidth() {
        // Default widths if sprite information is unavailable
        switch (this.type) {
            case 'car':
                this.width = 60;
                break;
            case 'truck':
                this.width = 80;
                break;
            case 'bus':
                this.width = 100;
                break;
            case 'emergency':
                this.width = 70;
                break;
            default:
                this.width = 60;
        }
    }
    
    /**
     * Updates the vehicle's position and honking state
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game for collision checking
     * @returns {boolean} True if the vehicle is still on screen, false if it should be removed
     */
    update(deltaTime, allVehicles) {
        // If vehicle has been hit by poop, update hit timer
        if (this.hitByPoop) {
            this.hitTimer += deltaTime;
            if (this.hitTimer >= this.hitDuration) {
                return false; // Remove vehicle after 3 seconds
            }
        }
        
        // If vehicle has crashed, update fire and crash timer
        if (this.hasCrashed) {
            // Update fire animation
            if (this.fire) {
                // Fire returns false when its duration is exceeded
                if (!this.fire.update(deltaTime)) {
                    return false; // Remove vehicle
                }
            } else {
                // If no fire exists but vehicle is crashed, increment crash timer
                this.crashTimer += deltaTime;
                if (this.crashTimer >= this.crashDuration) {
                    return false; // Remove vehicle
                }
            }
            
            return true; // Keep crashed vehicle until fire is gone
        }
        
        // Update speed (smooth acceleration/deceleration)
        if (this.speed !== this.targetSpeed) {
            const speedDiff = this.targetSpeed - this.speed;
            const speedChangeThisFrame = Math.min(
                Math.abs(speedDiff), 
                this.acceleration * deltaTime
            ) * Math.sign(speedDiff);
            
            this.speed += speedChangeThisFrame;
            
            // Snap to target speed if very close to avoid floating point issues
            if (Math.abs(this.speed - this.targetSpeed) < 1) {
                this.speed = this.targetSpeed;
            }
        }
        
        // Update position
        this.x += this.speed * deltaTime;
        
        // Check if vehicle is out of bounds
        if ((this.direction === 'left' && this.x < -this.width) || 
            (this.direction === 'right' && this.x > this.canvasWidth + this.width)) {
            return false; // Vehicle should be removed
        }
        
        // Handle lane changes if in progress
        if (this.isChangingLane) {
            this.laneChangeProgress += deltaTime / this.laneChangeSpeed;
            if (this.laneChangeProgress >= 1) {
                // Lane change complete
                this.lane = this.targetLane;
                this.y = this.targetY;
                this.isChangingLane = false;
                this.laneChangeProgress = 0;
                
                // If we were slowing down and now lane change is complete,
                // check if we can return to normal speed
                if (this.isSlowingDown) {
                    // Check if the collision risk is gone
                    this.checkIfCanReturnToNormalSpeed(allVehicles);
                }
            } else {
                // Interpolate position between lanes
                this.y = this.originalY + (this.targetY - this.originalY) * this.laneChangeProgress;
            }
        } else if (allVehicles) {
            // Check for potential collisions with other vehicles
            this.detectAndAvoidCollisions(allVehicles, deltaTime);
            
            // If we're slowing down but not changing lanes, check if we can return to normal speed
            if (this.isSlowingDown && !this.isChangingLane) {
                this.checkIfCanReturnToNormalSpeed(allVehicles);
            }
            
            // Check for actual collisions with other vehicles
            this.checkForVehicleCollisions(allVehicles);
        }
        
        // Handle honking
        if (this.isHonking) {
            // Update honk timer
            this.honkTimer += deltaTime;
            
            // Stop honking after the set duration
            if (this.honkTimer >= this.honkDuration) {
                this.stopHonkSound();
                this.honkTimer = 0;
                // Set a cooldown before honking again (3-7 seconds)
                this.honkCooldown = Math.random() * 4 + 3;
            }
            
            // Update honk animation
            if (this.honkAnimationTimer > 0) {
                this.honkAnimationTimer = Math.max(0, this.honkAnimationTimer - deltaTime);
            }
        } else if (this.honkCooldown > 0) {
            // Update honk cooldown
            this.honkCooldown -= deltaTime;
        }
        
        return true; // Vehicle is still active
    }
    
    /**
     * Detects potential collisions with other vehicles and initiates lane changes to avoid them
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     * @param {number} deltaTime - Time elapsed since last update in seconds
     */
    detectAndAvoidCollisions(allVehicles, deltaTime) {
        // Don't check if already changing lanes
        if (this.isChangingLane) return;
        
        // Check for vehicles in the same lane going in the opposite direction
        const oppositeDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            ((this.direction === 'left' && vehicle.direction === 'right') || 
             (this.direction === 'right' && vehicle.direction === 'left'))
        );
        
        // Check for vehicles in the same lane going in the same direction
        const sameDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            this.direction === vehicle.direction
        );
        
        // Check for collisions with opposite direction vehicles first
        for (const vehicle of oppositeDirectionVehicles) {
            // Calculate time to collision
            const timeToCollision = this.calculateTimeToCollision(vehicle);
            
            // If vehicles are about to collide, slow down and attempt lane change
            if (timeToCollision !== null) {
                if (timeToCollision < 3) { // Start slowing down earlier, at 3 seconds
                    // Start slowing down
                    this.slowDown();
                    
                    // If closer than 2 seconds, attempt lane change
                    if (timeToCollision < 2) {
                        this.attemptLaneChange(allVehicles, true); // true indicates opposing traffic
                    }
                    
                    return; // Exit after handling the first potential collision
                }
            }
        }
        
        // If no opposite direction collisions, check same direction
        for (const vehicle of sameDirectionVehicles) {
            // For same direction, simple distance check
            const distance = this.direction === 'right' 
                ? vehicle.x - this.x  // If going right, check vehicles ahead
                : this.x - vehicle.x; // If going left, check vehicles ahead
                
            // Only consider vehicles ahead of us
            if (distance > 0 && distance < this.width * 4) { // Increased detection distance
                // Start slowing down
                this.slowDown();
                
                // If very close, attempt lane change
                if (distance < this.width * 2) {
                    this.attemptLaneChange(allVehicles, false); // false indicates same direction traffic
                }
                
                return;
            }
        }
    }
    
    /**
     * Slows the vehicle down to a random percentage between 5% and 30% of its original speed
     */
    slowDown() {
        if (this.isSlowingDown) return; // Already slowing down
        
        this.isSlowingDown = true;
        
        // Generate a random percentage between 5% and 30%
        const randomSlowdownPercentage = (Math.random() * 25 + 5) / 100; // 0.05 to 0.30
        // Set target speed to the random percentage of original speed (keeping the sign)
        this.targetSpeed = this.originalSpeed * randomSlowdownPercentage;
        
        // Reduced chance to honk when slowing down by 15%
        if (Math.random() < 0.425 && !this.isHonking && !this.hitByPoop && !this.hasCrashed && this.honkCooldown <= 0) { // Reduced from 50% to 42.5%
            this.playHonkSound();
            this.honkTimer = 0; // Reset honk timer
        }
    }
    
    /**
     * Checks if the vehicle can return to normal speed after a slowdown
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     */
    checkIfCanReturnToNormalSpeed(allVehicles) {
        // Check if there are any vehicles that would cause us to remain slowed down
        
        // Check for vehicles in the same lane going in the opposite direction
        const oppositeDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            ((this.direction === 'left' && vehicle.direction === 'right') || 
             (this.direction === 'right' && vehicle.direction === 'left'))
        );
        
        // Check for vehicles in the same lane going in the same direction
        const sameDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            this.direction === vehicle.direction
        );
        
        // Check for potential collisions
        let shouldRemainSlowed = false;
        
        // Check opposite direction
        for (const vehicle of oppositeDirectionVehicles) {
            const timeToCollision = this.calculateTimeToCollision(vehicle);
            if (timeToCollision !== null && timeToCollision < 3) {
                shouldRemainSlowed = true;
                break;
            }
        }
        
        // Check same direction
        if (!shouldRemainSlowed) {
            for (const vehicle of sameDirectionVehicles) {
                const distance = this.direction === 'right' 
                    ? vehicle.x - this.x
                    : this.x - vehicle.x;
                    
                if (distance > 0 && distance < this.width * 4) {
                    shouldRemainSlowed = true;
                    break;
                }
            }
        }
        
        // If no collision risks, return to normal speed
        if (!shouldRemainSlowed) {
            this.isSlowingDown = false;
            this.targetSpeed = this.originalSpeed;
        }
    }
    
    /**
     * Calculates time to collision with another vehicle
     * @param {Vehicle} otherVehicle - The other vehicle to check against
     * @returns {number|null} Time in seconds until collision, or null if no collision is expected
     */
    calculateTimeToCollision(otherVehicle) {
        // Ensure vehicles are approaching each other
        const approachingFromLeft = this.direction === 'right' && otherVehicle.direction === 'left' && this.x < otherVehicle.x;
        const approachingFromRight = this.direction === 'left' && otherVehicle.direction === 'right' && this.x > otherVehicle.x;
        
        if (!approachingFromLeft && !approachingFromRight) {
            return null; // Vehicles are not approaching each other
        }
        
        // Calculate distance between vehicles
        const distance = Math.abs(this.x - otherVehicle.x) - (this.width / 2) - (otherVehicle.width / 2);
        
        // Calculate relative speed (closing speed)
        const relativeSpeed = Math.abs(this.speed) + Math.abs(otherVehicle.speed);
        
        // Calculate time to collision
        if (relativeSpeed > 0 && distance > 0) {
            return distance / relativeSpeed;
        }
        
        return null; // No collision expected
    }
    
    /**
     * Attempts to change lanes to avoid a collision
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game for checking lane availability
     * @param {boolean} isOpposingTraffic - Whether the lane change is triggered by opposing traffic
     */
    attemptLaneChange(allVehicles, isOpposingTraffic) {
        // Identify adjacent lanes, including emergency lanes in critical situations
        const adjacentLanes = [];
        const includeEmergencyLanes = this.isEmergencySituation(allVehicles);
        
        // Add lane above (including emergency lane 0 if critical)
        if (this.lane > 1) {
            adjacentLanes.push(this.lane - 1); // Normal lane above
        }
        if (includeEmergencyLanes && this.lane === 1) {
            adjacentLanes.push(0); // Emergency lane (top)
        }
        
        // Add lane below, including lane 4 (restricted) and emergency lane 5 if critical
        if (this.lane < 3) {
            adjacentLanes.push(this.lane + 1); // Normal lane below
        }
        if (this.lane === 3) {
            // Lane 4 (restricted) is available for lane changes (not spawning)
            adjacentLanes.push(4);
        }
        if (includeEmergencyLanes && this.lane === 4) {
            adjacentLanes.push(5); // Emergency lane (bottom)
        }
        
        // If no adjacent lanes available, exit
        if (adjacentLanes.length === 0) return;
        
        // Filter to available lanes (no vehicles within safety distance)
        const availableLanes = adjacentLanes.filter(lane => this.isLaneClear(lane, allVehicles));
        
        // If there are available lanes, select one based on direction and traffic type
        if (availableLanes.length > 0) {
            let targetLane;
            
            if (isOpposingTraffic) {
                // For opposing traffic, use directional preference
                if (this.direction === 'right') { // Cars coming from left
                    // Prefer moving up (-50%)
                    const upperLanes = availableLanes.filter(lane => lane < this.lane);
                    if (upperLanes.length > 0) {
                        targetLane = upperLanes[Math.floor(Math.random() * upperLanes.length)];
                    } else {
                        targetLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
                    }
                } else { // Cars coming from right
                    // Prefer moving down (50%)
                    const lowerLanes = availableLanes.filter(lane => lane > this.lane);
                    if (lowerLanes.length > 0) {
                        targetLane = lowerLanes[Math.floor(Math.random() * lowerLanes.length)];
                    } else {
                        targetLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
                    }
                }
            } else {
                // For same direction traffic, random selection as before
                targetLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
            }
            
            // Initiate lane change
            this.startLaneChange(targetLane);
        }
    }
    
    /**
     * Determines if this is an emergency situation warranting the use of emergency lanes
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     * @returns {boolean} True if emergency lanes should be considered
     */
    isEmergencySituation(allVehicles) {
        // Check for imminent collisions (less than 1 second away)
        const oppositeDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            ((this.direction === 'left' && vehicle.direction === 'right') || 
             (this.direction === 'right' && vehicle.direction === 'left'))
        );
        
        for (const vehicle of oppositeDirectionVehicles) {
            const timeToCollision = this.calculateTimeToCollision(vehicle);
            // If collision is imminent (less than 1 second), it's an emergency
            if (timeToCollision !== null && timeToCollision < 1) {
                return true;
            }
        }
        
        // Check for extremely close same-direction vehicles
        const sameDirectionVehicles = allVehicles.filter(vehicle => 
            vehicle !== this && 
            vehicle.lane === this.lane && 
            this.direction === vehicle.direction
        );
        
        for (const vehicle of sameDirectionVehicles) {
            const distance = this.direction === 'right' 
                ? vehicle.x - this.x
                : this.x - vehicle.x;
                
            // If vehicle is extremely close (less than width), it's an emergency
            if (distance > 0 && distance < this.width) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Checks if a lane is clear of other vehicles within a safety distance
     * @param {number} lane - The lane to check
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     * @returns {boolean} True if the lane is safe to move into
     */
    isLaneClear(lane, allVehicles) {
        const safetyDistance = this.width * 2; // Safety distance is twice the vehicle width
        
        // Check if any vehicles are too close in the target lane
        return !allVehicles.some(vehicle => 
            vehicle !== this && 
            vehicle.lane === lane && 
            Math.abs(vehicle.x - this.x) < safetyDistance
        );
    }
    
    /**
     * Starts a lane change maneuver to the target lane
     * @param {number} targetLane - The lane to change to
     */
    startLaneChange(targetLane) {
        this.isChangingLane = true;
        this.targetLane = targetLane;
        this.laneChangeProgress = 0;
        this.originalY = this.y;
        this.targetY = this.laneStartY + (targetLane * this.laneHeight) + (this.laneHeight / 2);
    }
    
    /**
     * Plays a honking sound based on the vehicle type
     */
    playHonkSound() {
        // If already honking, don't start a new sound
        if (this.isHonking && this.honkingAudio) {
            return;
        }
        
        // Check if we've reached the maximum number of concurrent honk sounds
        if (Vehicle.activeHonkSounds >= Vehicle.MAX_CONCURRENT_HONKS) {
            // Just set the visual honking state but don't play sound
            this.isHonking = true;
            this.lastHonkTime = Date.now() / 1000; // Update last honk time
            
            // Start the sound wave animation
            this.soundWaves = [{
                radius: 5,
                opacity: 1
            }];
            return;
        }
        
        // Get all available honk sounds
        const availableHonks = [];
        if (assets && assets.sounds && assets.sounds.vehicles) {
            // Collect all available honk sounds
            for (const key in assets.sounds.vehicles) {
                if (key.startsWith('honk')) {
                    availableHonks.push(assets.sounds.vehicles[key]);
                }
            }
        }
        
        // If we have honk sounds, randomly select one
        if (availableHonks.length > 0) {
            // Select a random honk sound
            const randomIndex = Math.floor(Math.random() * availableHonks.length);
            const honkSound = availableHonks[randomIndex];
            
            // Reset and play the sound
            honkSound.currentTime = 0;
            
            try {
                // Start the honking
                this.honkingAudio = honkSound;
                this.isHonking = true;
                this.lastHonkTime = Date.now() / 1000; // Update last honk time
                
                // Increment active honk counter
                Vehicle.activeHonkSounds++;
                
                // Add ended event listener to decrement counter when sound finishes
                const decrementCounter = () => {
                    Vehicle.activeHonkSounds = Math.max(0, Vehicle.activeHonkSounds - 1);
                    honkSound.removeEventListener('ended', decrementCounter);
                };
                honkSound.addEventListener('ended', decrementCounter);
                
                // Play the sound
                const playPromise = honkSound.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.warn('Audio play was prevented:', error);
                        // Decrement counter if play fails
                        Vehicle.activeHonkSounds = Math.max(0, Vehicle.activeHonkSounds - 1);
                        // Visually show honking even if sound doesn't play
                        this.isHonking = true;
                    });
                }
            } catch (e) {
                console.warn('Error playing honk sound:', e);
                // Decrement counter if play throws error
                Vehicle.activeHonkSounds = Math.max(0, Vehicle.activeHonkSounds - 1);
                // Visually show honking even if sound doesn't play
                this.isHonking = true;
            }
        } else {
            // No sounds available, just set honking flag
            this.isHonking = true;
            this.lastHonkTime = Date.now() / 1000; // Update last honk time
        }
        
        // Start the sound wave animation
        this.soundWaves = [{
            radius: 5,
            opacity: 1
        }];
    }
    
    /**
     * Stops any currently playing honk sound
     */
    stopHonkSound() {
        // Stop audio playback
        if (this.honkingAudio) {
            try {
                this.honkingAudio.pause();
                this.honkingAudio.currentTime = 0;
                
                // Decrement active honk counter
                Vehicle.activeHonkSounds = Math.max(0, Vehicle.activeHonkSounds - 1);
                
                this.honkingAudio = null;
            } catch (e) {
                console.warn('Error stopping honk sound:', e);
            }
        }
        
        // Clear visual honking state
        this.isHonking = false;
    }
    
    /**
     * Checks if the vehicle is currently honking or was honking recently
     * @returns {boolean} True if honking or was honking within grace period
     */
    isCurrentlyHonking() {
        const currentTime = Date.now() / 1000; // Convert to seconds
        return this.isHonking || (currentTime - this.lastHonkTime < this.honkGracePeriod);
    }
    
    /**
     * Checks for collisions with other vehicles
     * @param {Array<Vehicle>} allVehicles - All vehicles in the game
     */
    checkForVehicleCollisions(allVehicles) {
        // Skip if already crashed
        if (this.hasCrashed) return;
        
        // Check for collisions with other non-crashed vehicles
        for (const otherVehicle of allVehicles) {
            // Skip self-comparison and already crashed vehicles
            if (otherVehicle === this || otherVehicle.hasCrashed) continue;
            
            // Simple bounding box collision detection
            const collision = 
                this.x - this.halfWidth < otherVehicle.x + otherVehicle.halfWidth &&
                this.x + this.halfWidth > otherVehicle.x - otherVehicle.halfWidth &&
                this.y - this.halfHeight < otherVehicle.y + otherVehicle.halfHeight &&
                this.y + this.halfHeight > otherVehicle.y - otherVehicle.halfHeight;
                
            if (collision) {
                // If moving in opposite directions, check speeds
                const isOppositeDirection = 
                    (this.direction === 'left' && otherVehicle.direction === 'right') ||
                    (this.direction === 'right' && otherVehicle.direction === 'left');
                
                // Check if both vehicles are moving slow enough to pass through each other
                // Slow is defined as less than 30% of original speed (in absolute terms)
                const thisIsSlow = Math.abs(this.speed) < Math.abs(this.originalSpeed) * 0.3;
                const otherIsSlow = Math.abs(otherVehicle.speed) < Math.abs(otherVehicle.originalSpeed) * 0.3;
                
                // If both are slow, or moving in same direction, allow them to pass through
                if ((thisIsSlow && otherIsSlow) || !isOppositeDirection) {
                    // Just pass through each other (ghosting)
                    continue;
                } else {
                    // Trigger crash for both vehicles
                    this.crash();
                    otherVehicle.crash();
                }
                
                break; // Only handle one collision at a time
            }
        }
    }
    
    /**
     * Triggers a crash state for this vehicle
     */
    crash() {
        // Only crash if not already crashed
        if (this.hasCrashed) return;
        
        // Set crash flags and stop the vehicle
        this.hasCrashed = true;
        this.speed = 0;
        this.targetSpeed = 0;
        this.crashTimer = 0;
        
        // Log information about fire sprites
        const fireSprites = assets.visuals.vehicles.fire_sprites;
        console.log(`Vehicle crash: Creating fire with ${fireSprites ? fireSprites.length : 0} sprites from /assets/visuals/vehicles/fire_sprites`);
        
        // Create fire animation at vehicle position
        this.fire = new Fire(
            this.x,               // X position
            this.y,               // Y position
            this.width * 1.5,     // Width
            this.height * 1.8,    // Height
            this.crashDuration    // Duration
        );
        
        // Stop any honking
        if (this.isHonking) {
            this.stopHonkSound();
            this.isHonking = false;
        }
        
        // Dispatch a custom crash event for the game to listen to
        if (typeof window !== 'undefined') {
            const crashEvent = new CustomEvent('vehicleCrash', { 
                detail: { 
                    vehicle: this,
                    x: this.x,
                    y: this.y,
                    type: this.type
                } 
            });
            window.dispatchEvent(crashEvent);
        }
    }
    
    /**
     * Draws the vehicle on the canvas
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    draw(ctx) {
        ctx.save();
        
        // Draw vehicle sprite and continue only if successful
        if (!this.drawVehicleSprite(ctx)) {
            // If drawing the sprite failed, don't draw anything else
            ctx.restore();
            return;
        }
        
        // Draw fire if crashed
        if (this.hasCrashed && this.fire) {
            this.fire.draw(ctx);
        }
        
        // Draw sound waves if honking (and not hit by poop)
        if (this.isHonking && !this.hitByPoop && this.soundWaves.length > 0) {
            this.drawSoundWaves(ctx);
        }
        
        // Draw pile sprite if hit by poop
        if (this.hitByPoop && assets.visuals.drops && assets.visuals.drops.pile) {
            // Draw pile on top of the vehicle
            const pileImg = assets.visuals.drops.pile;
            const pileWidth = this.width * 0.7;
            const pileHeight = pileWidth * (pileImg.height / pileImg.width);
            
            ctx.drawImage(
                pileImg,
                this.x - pileWidth / 2,
                this.y - this.height / 2 - pileHeight / 2,
                pileWidth,
                pileHeight
            );
        }
        
        ctx.restore();
    }
    
    /**
     * Draws the vehicle sprite
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawVehicleSprite(ctx) {
        // Get sprite array for this vehicle type and direction
        const spriteArray = assets.visuals.vehicles[`${this.type}_sprites`][this.direction];
        
        if (spriteArray && spriteArray.length > 0 && this.spriteIndex < spriteArray.length) {
            // Draw vehicle sprite
            const sprite = spriteArray[this.spriteIndex];
            
            if (sprite) {
                // Calculate consistent bounce for honk animation
                let bounceY = 0;
                if (this.honkAnimationTimer > 0) {
                    // Use a deterministic calculation based on a known value
                    const bounceFrequency = 10; // Hz
                    const bounceAmplitude = 2; // pixels
                    const phase = this.honkAnimationTimer * Math.PI * bounceFrequency;
                    bounceY = Math.sin(phase) * bounceAmplitude;
                }
                
                // Draw the sprite at its position
                ctx.drawImage(
                    sprite, 
                    this.x - this.halfWidth, 
                    this.y - this.halfHeight + bounceY, 
                    this.width, 
                    this.height
                );
                
                return true; // Successfully drew sprite
            }
        }
        
        // If we've reached this point, we don't have a valid sprite to draw
        // Fall back to basic shape drawing
        this.drawFallback(ctx);
        return true;
    }
    
    /**
     * Draws a fallback vehicle when sprite is not available
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawFallback(ctx) {
        ctx.save();
        
        // Use subtle, semi-transparent colors instead of bright solid colors
        const baseColor = this.type === 'car' ? 'rgba(70, 130, 180, 0.8)' :  // Steel blue for cars
                         this.type === 'truck' ? 'rgba(119, 136, 153, 0.8)' : // Slate gray for trucks
                         this.type === 'bus' ? 'rgba(160, 82, 45, 0.8)' :    // Sienna for buses
                         'rgba(178, 34, 34, 0.8)';                          // Firebrick for emergency
        
        // Create a gradient for a more natural look
        const gradient = ctx.createLinearGradient(
            this.x - this.width/2, this.y, 
            this.x + this.width/2, this.y
        );
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.5, this.adjustColor(baseColor, 30)); // Lighter in middle
        gradient.addColorStop(1, baseColor);
        
        ctx.fillStyle = gradient;
        
        // Draw rounded vehicle body
        ctx.beginPath();
        const radius = 8; // Rounded corners
        
        // Draw rounded rectangle
        const x = this.x - this.width/2;
        const y = this.y - this.height/2;
        const width = this.width;
        const height = this.height;
        
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        
        // Add a subtle shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        
        ctx.fill();
        
        // Add details (windows, etc.)
        this.drawVehicleDetails(ctx);
        
        // Draw honking indicator if honking
        if (this.isHonking) {
            this.drawHonkBubble(ctx);
        }
        
        ctx.restore();
    }
    
    /**
     * Draws details on the fallback vehicle
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawVehicleDetails(ctx) {
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw windshield and windows
        ctx.fillStyle = 'rgba(200, 220, 240, 0.7)'; // Light blue tint for glass
        
        // Windshield position depends on direction
        const frontPosition = this.direction === 'right' ? 
            this.x + this.width/2 - this.width/5 :
            this.x - this.width/2 + this.width/5;
            
        // Draw windshield (front)
        ctx.fillRect(
            frontPosition - this.width/10,
            this.y - this.height/3,
            this.width/5,
            this.height/2
        );
        
        // Draw headlights
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        const headlightY = this.y + this.height/5;
        const headlightSize = this.width/12;
        
        if (this.direction === 'right') {
            // Right-facing headlight
            ctx.beginPath();
            ctx.arc(
                this.x + this.width/2 - headlightSize/2,
                headlightY,
                headlightSize,
                0,
                Math.PI * 2
            );
            ctx.fill();
        } else {
            // Left-facing headlight
            ctx.beginPath();
            ctx.arc(
                this.x - this.width/2 + headlightSize/2,
                headlightY,
                headlightSize,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
    
    /**
     * Utility function to adjust color brightness
     * @param {string} color - Color in rgba format
     * @param {number} amount - Amount to adjust brightness
     * @returns {string} Adjusted color
     */
    adjustColor(color, amount) {
        // Parse the rgba color
        const rgba = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
        if (!rgba) return color;
        
        let r = parseInt(rgba[1]) + amount;
        let g = parseInt(rgba[2]) + amount;
        let b = parseInt(rgba[3]) + amount;
        
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        const a = rgba[4] || "1";
        
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    
    /**
     * Checks if a dropping has collided with this vehicle
     * @param {Object} dropping - The dropping object with x, y, width, height properties
     * @returns {boolean} True if collision detected, false otherwise
     */
    checkCollision(dropping) {
        if (!dropping) return false;
        
        // Simple bounding box collision detection
        return (
            this.x - this.width/2 < dropping.x + dropping.width/2 &&
            this.x + this.width/2 > dropping.x - dropping.width/2 &&
            this.y - this.height/2 < dropping.y + dropping.height/2 &&
            this.y + this.height/2 > dropping.y - dropping.height/2
        );
    }
    
    /**
     * Handles what happens when this vehicle is hit by a dropping
     * @param {number} powerLevel - The current power level of the bird (1-5)
     * @returns {number} Score value based on whether the vehicle was honking
     */
    handleHit(powerLevel = 1) {
        // If already hit, don't process again
        if (this.hitByPoop) return 0;
        
        // Store whether the vehicle was honking or recently honking
        const wasHonking = this.isCurrentlyHonking();
        
        // Stop honking
        this.stopHonkSound();
        this.isHonking = false;
        
        // Clear sound waves animation
        this.soundWaves = [];
        
        // Mark vehicle as hit by poop
        this.hitByPoop = true;
        this.hitTimer = 0;
        
        // Adjust hit duration based on power level
        // Power level 1: 3 seconds (default)
        // Power level 2: 2 seconds
        // Power level 3: 1 second
        // Power level 4: 0.5 seconds
        // Power level 5: instant (0 seconds)
        this.hitDuration = powerLevel === 5 ? 0 : 
                          powerLevel === 4 ? 0.5 :
                          powerLevel === 3 ? 1.0 :
                          powerLevel === 2 ? 2.0 : 3.0;
        
        // Special scoring for emergency vehicles: always deduct 15 points
        if (this.type === 'emergency') {
            return -15; // Deduct 15 points for hitting emergency vehicles
        }
        
        // Regular scoring for other vehicles
        // Return 5 points if the vehicle was honking or recently honking, -10 if it wasn't
        return wasHonking ? 5 : -10;
    }
    
    /**
     * Draws sound waves emanating from a honking vehicle
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawSoundWaves(ctx) {
        // Get the effective wave number, capped at 3
        const effectiveWave = Math.min(Vehicle.currentWave, 3);
        
        // Calculate wave size multiplier based on the effective wave (capped at wave 3)
        // Start with 1.0 at wave 1, and add 0.2 for each wave (20% increase per wave)
        // Reduced by 15%
        let waveMultiplier = (1.0 + (effectiveWave - 1) * 0.2) * 0.85; // 15% reduction in wave size
        
        // Special case: Emergency vehicles have 55% larger sound waves
        if (this.type === 'emergency') {
            waveMultiplier *= 1.55; // 55% larger for emergency vehicles (reduced from 70%)
        }
        
        // Update existing sound waves
        for (let i = 0; i < this.soundWaves.length; i++) {
            const wave = this.soundWaves[i];
            
            // Draw the sound wave with scaled radius
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 0, 0, ${wave.opacity})`;
            ctx.lineWidth = 2;
            ctx.arc(
                this.x,
                this.y - this.height / 2,
                wave.radius * waveMultiplier, // Scale radius based on wave multiplier
                0,
                Math.PI * 2
            );
            ctx.stroke();
            
            // Expansion rate - faster for emergency vehicles
            let expansionRate = 2 + (effectiveWave - 1) * 0.5;
            if (this.type === 'emergency') {
                expansionRate *= 1.3; // 30% faster expansion for emergency vehicles
            }
            
            // Expand the wave (increase expansion rate with wave number, capped at wave 3)
            wave.radius += expansionRate;
            wave.opacity -= 0.03;
        }
        
        // Remove faded waves
        this.soundWaves = this.soundWaves.filter(wave => wave.opacity > 0);
        
        // Add new wave when needed - emergency vehicles produce waves more frequently
        // Reduce wave generation frequency by 15%
        const newWaveChance = this.type === 'emergency' ? 0.1275 : 0.085; // Reduced from 0.15/0.1 by 15%
        if (Math.random() < newWaveChance && this.soundWaves.length < 5) {
            this.soundWaves.push({
                radius: 5,
                opacity: 1
            });
        }
    }
    
    /**
     * Draws a speech bubble indicating the vehicle is honking
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     */
    drawHonkBubble(ctx) {
        const bubbleWidth = this.width * 0.7;
        const bubbleHeight = bubbleWidth * 0.7;
        const bubbleX = this.direction === 'left' ? 
            this.x - this.width/2 - bubbleWidth/2 :
            this.x + this.width/2 + bubbleWidth/2;
        const bubbleY = this.y - this.height/2 - bubbleHeight;
        
        // Draw bubble
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        
        // Draw rounded rectangle for bubble
        ctx.beginPath();
        const radius = 8;
        ctx.moveTo(bubbleX - bubbleWidth/2 + radius, bubbleY - bubbleHeight/2);
        ctx.lineTo(bubbleX + bubbleWidth/2 - radius, bubbleY - bubbleHeight/2);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth/2, bubbleY - bubbleHeight/2, bubbleX + bubbleWidth/2, bubbleY - bubbleHeight/2 + radius);
        ctx.lineTo(bubbleX + bubbleWidth/2, bubbleY + bubbleHeight/2 - radius);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth/2, bubbleY + bubbleHeight/2, bubbleX + bubbleWidth/2 - radius, bubbleY + bubbleHeight/2);
        ctx.lineTo(bubbleX - bubbleWidth/2 + radius, bubbleY + bubbleHeight/2);
        ctx.quadraticCurveTo(bubbleX - bubbleWidth/2, bubbleY + bubbleHeight/2, bubbleX - bubbleWidth/2, bubbleY + bubbleHeight/2 - radius);
        ctx.lineTo(bubbleX - bubbleWidth/2, bubbleY - bubbleHeight/2 + radius);
        ctx.quadraticCurveTo(bubbleX - bubbleWidth/2, bubbleY - bubbleHeight/2, bubbleX - bubbleWidth/2 + radius, bubbleY - bubbleHeight/2);
        ctx.closePath();
        
        // Add a pointer to the vehicle
        ctx.moveTo(bubbleX, bubbleY + bubbleHeight/2);
        ctx.lineTo(bubbleX - 10, bubbleY + bubbleHeight/2 + 15);
        ctx.lineTo(bubbleX + 10, bubbleY + bubbleHeight/2 + 15);
        ctx.closePath();
        
        // Fill and stroke the bubble
        ctx.fill();
        ctx.stroke();
        
        // Draw "HONK!" text
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HONK!', bubbleX, bubbleY);
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Vehicle };
} 